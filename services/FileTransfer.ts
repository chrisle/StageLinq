import { DOWNLOAD_TIMEOUT } from '../types';
import { Logger } from '../LogEmitter';
import { ReadContext } from '../utils/ReadContext';
import { Service } from './Service';
import { sleep } from '../utils/sleep';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import type { ServiceMessage, Source } from '../types';

const MAGIC_MARKER = 'fltx';
export const CHUNK_SIZE = 4096;

// FIXME: Strongly type this for all possible messages?
type FileTransferData = any;

enum MessageId {
  TimeCode = 0x0,
  FileStat = 0x1,
  EndOfMessage = 0x2,
  SourceLocations = 0x3,
  FileTransferId = 0x4,
  FileTransferChunk = 0x5,
  Unknown0 = 0x8,
}

interface FileTransferProgress {
  sizeLeft: number;
  total: number;
  bytesDownloaded: number;
  percentComplete: number;
}

export declare interface FileTransfer {
  on(event: 'fileTransferProgress', listener: (progress: FileTransferProgress) => void): this;
}

export class FileTransfer extends Service<FileTransferData> {
  private receivedFile: WriteContext = null;

  async init() {}

  protected parseData(p_ctx: ReadContext): ServiceMessage<FileTransferData> {
    const check = p_ctx.getString(4);
    assert(check === MAGIC_MARKER);
    const code = p_ctx.readUInt32();

    // If first 4 bytes are non-zero, a timecode is sent
    if (code > 0) {
      assert(p_ctx.sizeLeft() === 8);
      const id = p_ctx.readUInt32();
      assert(id === 0x07d2);
      assert(p_ctx.readUInt32() === 0);
      return {
        id: MessageId.TimeCode,
        message: {
          timecode: code,
        },
      };
    }

    // Else
    const messageId: MessageId = p_ctx.readUInt32();
    switch (messageId) {
      case MessageId.SourceLocations: {
        const sources: string[] = [];
        const sourceCount = p_ctx.readUInt32();
        for (let i = 0; i < sourceCount; ++i) {
          // We get a location
          const location = p_ctx.readNetworkStringUTF16();
          sources.push(location);
        }
        // Final three bytes should be 0x1 0x1 0x1
        assert(p_ctx.readUInt8() === 0x1);
        assert(p_ctx.readUInt8() === 0x1);
        assert(p_ctx.readUInt8() === 0x1);
        assert(p_ctx.isEOF());
        return {
          id: messageId,
          message: {
            sources: sources,
          },
        };
      }

      case MessageId.FileStat: {
        assert(p_ctx.sizeLeft() === 53);
        // Last 4 bytes (FAT32) indicate size of file
        p_ctx.seek(49);
        const size = p_ctx.readUInt32();
        return {
          id: messageId,
          message: {
            size: size,
          },
        };
      }

      case MessageId.EndOfMessage: {
        // End of result indication?
        return {
          id: messageId,
          message: null,
        };
      }

      case MessageId.FileTransferId: {
        assert(p_ctx.sizeLeft() === 12);
        assert(p_ctx.readUInt32() === 0x0);
        const filesize = p_ctx.readUInt32();
        const id = p_ctx.readUInt32();

        return {
          id: messageId,
          message: {
            size: filesize,
            txid: id,
          },
        };
      }

      case MessageId.FileTransferChunk: {
        assert(p_ctx.readUInt32() === 0x0);
        const offset = p_ctx.readUInt32();
        const chunksize = p_ctx.readUInt32();
        assert(chunksize === p_ctx.sizeLeft());
        assert(p_ctx.sizeLeft() <= CHUNK_SIZE);

        return {
          id: messageId,
          message: {
            data: p_ctx.readRemainingAsNewBuffer(),
            offset: offset,
            size: chunksize,
          },
        };
      }

      case MessageId.Unknown0: {
        return {
          id: messageId,
          message: null,
        };
      }

      default:
        {
          assert.fail(`File Transfer Unhandled message id '${messageId}'`);
        }
        break;
    }
  }

  protected messageHandler(p_data: ServiceMessage<FileTransferData>): void {
    if (p_data.id === MessageId.FileTransferChunk && this.receivedFile) {
      assert(this.receivedFile.sizeLeft() >= p_data.message.size);
      this.receivedFile.write(p_data.message.data);
    } else {
      // Logger.log(p_data);
    }
  }

  async getFile(p_location: string): Promise<Uint8Array> {
    assert(this.receivedFile === null);

    await this.requestFileTransferId(p_location);
    const txinfo = await this.waitForMessage(MessageId.FileTransferId);

    if (txinfo) {
      this.receivedFile = new WriteContext({ size: txinfo.size });

      const totalChunks = Math.ceil(txinfo.size / CHUNK_SIZE);

      await this.requestChunkRange(txinfo.txid, 0, totalChunks - 1);

      try {
        await new Promise(async (resolve, reject) => {
          setTimeout(() => {
            reject(new Error(`Failed to download '${p_location}'`));
          }, DOWNLOAD_TIMEOUT);

          while (this.receivedFile.isEOF() === false) {
            const total = parseInt(txinfo.size);
            const bytesDownloaded = total - this.receivedFile.sizeLeft();
            const percentComplete = (bytesDownloaded / total) * 100;
            this.emit('fileTransferProgress', {
              sizeLeft: this.receivedFile.sizeLeft(),
              total: txinfo.size,
              bytesDownloaded: bytesDownloaded,
              percentComplete: percentComplete
            })
            Logger.debug(`Reading ${p_location} progressComplete=${Math.ceil(percentComplete)}% ${bytesDownloaded}/${total}`);
            await sleep(200);
          }
          Logger.debug(`Download complete.`);
          resolve(true);
        });
      } catch (err) {
        const msg = `Could not read database from ${p_location}: ${err.message}`
        Logger.error(msg);
        throw new Error(msg);
      }

      Logger.debug(`Signaling transfer complete.`);
      await this.signalTransferComplete();
    }

    const buf = this.receivedFile ? this.receivedFile.getBuffer() : null;
    this.receivedFile = null;
    return buf;
  }

  async getSources(): Promise<Source[]> {
    const result: Source[] = [];

    await this.requestSources();
    const message = await this.waitForMessage(MessageId.SourceLocations);
    if (message) {
      for (const source of message.sources) {
        //try to retrieve V2.x Database2/m.db first. If file doesn't exist or 0 size, retrieve V1.x /m.db
        const databases = [`/${source}/Engine Library/Database2/m.db`, `/${source}/Engine Library/m.db`];
        for (const database of databases) {
          await this.requestStat(database);
          const fstatMessage = await this.waitForMessage(MessageId.FileStat);
          if (fstatMessage.size > 0) {
            result.push({
              name: source,
              database: {
                location: database,
                size: fstatMessage.size,
              },
            });
            break;
          }
        }
      }
    }

    return result;
  }

  ///////////////////////////////////////////////////////////////////////////
  // Private methods

  private async requestStat(p_filepath: string): Promise<void> {
    // 0x7d1: seems to request some sort of fstat on a file
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(0x7d1);
    ctx.writeNetworkStringUTF16(p_filepath);
    await this.writeWithLength(ctx);
  }

  private async requestSources(): Promise<void> {
    // 0x7d2: Request available sources
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(0x7d2); // Database query
    ctx.writeUInt32(0x0);
    await this.writeWithLength(ctx);
  }

  private async requestFileTransferId(p_filepath: string): Promise<void> {
    // 0x7d4: Request transfer id?
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(0x7d4);
    ctx.writeNetworkStringUTF16(p_filepath);
    ctx.writeUInt32(0x0); // Not sure why we need 0x0 here
    await this.writeWithLength(ctx);
  }

  private async requestChunkRange(p_txid: number, p_chunkStartId: number, p_chunkEndId: number): Promise<void> {
    // 0x7d5: seems to be the code to request chunk range
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(0x7d5);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(p_txid); // I assume this is the transferid
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(p_chunkStartId);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(p_chunkEndId);
    await this.writeWithLength(ctx);
  }

  private async signalTransferComplete(): Promise<void> {
    // 0x7d6: seems to be the code to signal transfer completed
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(0x7d6);
    await this.writeWithLength(ctx);
  }
}
