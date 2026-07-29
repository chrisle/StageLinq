import { DOWNLOAD_TIMEOUT } from '../types';
import { ReadContext } from '../utils/ReadContext';
import { Service } from './Service';
import { sleep } from '../utils/sleep';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import type { ServiceMessage, Source } from '../types';

const MAGIC_MARKER = 'fltx';

/**
 * Chunk size assumed before the device tells us otherwise.
 *
 * The firmware picks the real chunk size, not us. Engine OS 5.x uses something
 * larger than this, so treat it strictly as a starting guess: it is only ever
 * used for a read that starts at byte 0 (chunk 0 is chunk 0 at any chunk size),
 * and is replaced by the measured value as soon as a chunk arrives.
 */
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
  ServiceDisconnect = 0x9,
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
  private receivedFile: WriteContext | null = null;
  private _available: boolean = true;

  /**
   * The device's real chunk size, measured from the wire. Null until a chunk
   * that is provably not a file's final chunk has been seen. The firmware
   * cannot change this mid-connection, so it is cached for the life of the
   * service.
   */
  private deviceChunkSize: number | null = null;

  async init() {}

  /**
   * Record the device's chunk size from an observed chunk.
   *
   * Only a chunk that is *not* the last chunk of its file carries the true
   * size — a final chunk is short, and a file smaller than one chunk arrives
   * whole. Those cases teach us nothing and are ignored rather than guessed at.
   */
  private noteChunkSize(byteStart: number, chunkLength: number, fileSize: number): void {
    if (byteStart + chunkLength >= fileSize) return;
    if (this.deviceChunkSize === chunkLength) return;
    this.logger.debug(`Device chunk size measured as ${chunkLength} bytes`);
    this.deviceChunkSize = chunkLength;
  }

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
        // The declared size must match what actually arrived. That is the real
        // integrity check; there is deliberately no upper bound on it, because
        // the device chooses the chunk size and Engine OS 5.x exceeds 4096.
        assert(chunksize === p_ctx.sizeLeft());

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

      case MessageId.ServiceDisconnect: {
        //This message is received when the player that FileTransfer is connected to shuts down
        this.disconnect();
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
      const room = this.receivedFile.sizeLeft();
      if (room <= 0) return;

      const chunk: Uint8Array = p_data.message.data;
      const fileSize = this.receivedFile.tell() + room;
      this.noteChunkSize(this.receivedFile.tell(), chunk.byteLength, fileSize);

      // Write only what still fits. A device may overrun the declared file size
      // on the final chunk, and WriteContext is autoGrow by default — letting it
      // resize would push the buffer past `size`, so isEOF() would never become
      // true and getFile() would spin until DOWNLOAD_TIMEOUT. Slicing keeps the
      // write position landing exactly on the end of the file.
      this.receivedFile.write(room < chunk.byteLength ? chunk.subarray(0, room) : chunk);
    } else {
      // Logger.log(p_data);
    }
  }

  async getFile(p_location: string): Promise<Uint8Array> {
    assert(this.receivedFile === null);

    if (this._available) {
      this._available = false;
    }
    await this.requestFileTransferId(p_location);
    const txinfo = await this.waitForMessage(MessageId.FileTransferId);

    if (txinfo) {
      this.receivedFile = new WriteContext({ size: txinfo.size });

      // Over-requesting is harmless (the device stops at EOF) but requesting
      // too few chunks would leave the write buffer short of isEOF() and hang,
      // so fall back to the smaller assumed size until the real one is known.
      const totalChunks = Math.ceil(txinfo.size / (this.deviceChunkSize ?? CHUNK_SIZE));
      const total = parseInt(txinfo.size);

      if (total === 0) {
        this.logger.warn(`${p_location} doesn't exist or is a streaming file`);
        return new Uint8Array(0);
      }

      await this.requestChunkRange(txinfo.txid, 0, totalChunks - 1);

      try {
        await new Promise(async (resolve, reject) => {
          setTimeout(() => {
            reject(new Error(`Failed to download '${p_location}'`));
          }, DOWNLOAD_TIMEOUT);

          while (this.receivedFile && this.receivedFile.isEOF() === false) {
            const bytesDownloaded = total - this.receivedFile.sizeLeft();
            const percentComplete = (bytesDownloaded / total) * 100;
            this.emit('fileTransferProgress', {
              sizeLeft: this.receivedFile?.sizeLeft() ?? 0,
              total: txinfo.size,
              bytesDownloaded: bytesDownloaded,
              percentComplete: percentComplete,
            });
            this.logger.debug(
              `Reading ${p_location} progressComplete=${Math.ceil(percentComplete)}% ${bytesDownloaded}/${total}`
            );
            await sleep(200);
          }
          this.logger.debug(`Download complete.`);
          resolve(true);
        });
      } catch (err) {
        const msg = `Could not read database from ${p_location}: ${err instanceof Error ? err.message : err}`;
        this.logger.error(msg);
        this._available = true;
        throw new Error(msg);
      }

      this.logger.debug(`Signaling transfer complete.`);
      await this.signalTransferComplete();
      this._available = true;
    }

    const buf = this.receivedFile ? this.receivedFile.getBuffer() : new Uint8Array(0);
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

  /**
   * Get the size of a file without downloading it
   */
  async getFileSize(p_location: string): Promise<number> {
    await this.requestStat(p_location);
    const fstatMessage = await this.waitForMessage(MessageId.FileStat);
    return fstatMessage.size;
  }

  /**
   * Read a specific byte range from a file
   * This only downloads the chunks needed for the requested range
   *
   * @param p_location - File path on the device
   * @param offset - Starting byte offset
   * @param length - Number of bytes to read
   * @returns Buffer containing the requested bytes
   */
  async getFileRange(p_location: string, offset: number, length: number): Promise<Buffer> {
    await this.waitTillAvailable();
    this._available = false;

    try {
      // `requestChunkRange` speaks in chunk indices, so a read that does not
      // start at byte 0 cannot be turned into a request until the device's
      // chunk size is known. In practice every parser reads the file header
      // first (offset 0), which is chunk 0 at any chunk size and measures the
      // size for free — so this probe is a rarely-taken fallback.
      if (this.deviceChunkSize === null && offset > 0) {
        await this.learnChunkSize(p_location);
      }

      // Request file transfer ID to get file size and txid
      await this.requestFileTransferId(p_location);
      const txinfo = await this.waitForMessage(MessageId.FileTransferId);

      if (!txinfo || txinfo.size === 0) {
        this.logger.warn(`${p_location} doesn't exist or is a streaming file`);
        return Buffer.alloc(0);
      }

      // Clamp the requested range to file size
      const fileSize = txinfo.size;
      const endOffset = Math.min(offset + length, fileSize);
      const actualLength = Math.max(0, endOffset - offset);

      if (actualLength === 0 || offset >= fileSize) {
        await this.signalTransferComplete();
        return Buffer.alloc(0);
      }

      const chunkSize = this.deviceChunkSize ?? CHUNK_SIZE;
      const startChunk = Math.floor(offset / chunkSize);
      const endChunk = Math.floor((endOffset - 1) / chunkSize);
      const firstByteStart = startChunk * chunkSize;

      const received = await this.receiveChunks(p_location, txinfo.txid, startChunk, endChunk, {
        firstByteStart,
        fileSize,
        targetBytes: endOffset - firstByteStart,
      });

      await this.signalTransferComplete();

      // Extract the exact bytes requested. Chunks are concatenated in arrival
      // order rather than placed by their reported offset: the device answers a
      // contiguous range sequentially over TCP, which is the same property
      // getFile() has always relied on.
      const startInBuffer = offset - firstByteStart;
      return received.subarray(startInBuffer, startInBuffer + actualLength);
    } finally {
      this._available = true;
    }
  }

  /**
   * Measure the device's chunk size with a self-contained transfer that pulls
   * only chunk 0 of `p_location`.
   *
   * Leaves `deviceChunkSize` unset when the file is smaller than a single chunk,
   * since that chunk says nothing about the device's size. Callers must already
   * hold the availability lock.
   */
  private async learnChunkSize(p_location: string): Promise<void> {
    await this.requestFileTransferId(p_location);
    const txinfo = await this.waitForMessage(MessageId.FileTransferId);
    if (!txinfo || txinfo.size === 0) return;

    // `targetBytes: 1` resolves on the first chunk, whatever its size.
    await this.receiveChunks(p_location, txinfo.txid, 0, 0, {
      firstByteStart: 0,
      fileSize: txinfo.size,
      targetBytes: 1,
    });
    await this.signalTransferComplete();
  }

  /**
   * Request chunks `p_startChunk`..`p_endChunk` and concatenate them in arrival
   * order.
   *
   * Completion is decided on bytes, not on a chunk count: a count would hang
   * whenever the requested range was computed with a smaller chunk size than
   * the device actually uses, because fewer chunks then cover the same bytes.
   */
  private async receiveChunks(
    p_location: string,
    p_txid: number,
    p_startChunk: number,
    p_endChunk: number,
    p_range: { firstByteStart: number; fileSize: number; targetBytes: number }
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let total = 0;

    const chunkPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeListener('message', chunkListener);
        reject(new Error(`Timeout reading range from '${p_location}'`));
      }, DOWNLOAD_TIMEOUT);

      const finish = () => {
        clearTimeout(timeout);
        this.removeListener('message', chunkListener);
        resolve();
      };

      const chunkListener = (p_message: ServiceMessage<FileTransferData>) => {
        if (p_message.id !== MessageId.FileTransferChunk) return;

        const data: Buffer = p_message.message.data;
        this.noteChunkSize(p_range.firstByteStart + total, data.byteLength, p_range.fileSize);

        chunks.push(data);
        total += data.byteLength;

        // Either the requested bytes are covered, or the file ran out first
        // (which happens whenever the range was over-requested past EOF).
        if (total >= p_range.targetBytes || p_range.firstByteStart + total >= p_range.fileSize) {
          finish();
        }
      };

      this.addListener('message', chunkListener);
    });

    await this.requestChunkRange(p_txid, p_startChunk, p_endChunk);
    await chunkPromise;

    return Buffer.concat(chunks);
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

  public async waitTillAvailable(): Promise<void> {
    while (!this._available) {
      await sleep(250);
    }
  }
}
