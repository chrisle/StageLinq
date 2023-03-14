import { DOWNLOAD_TIMEOUT } from '../types';
import { Logger } from '../LogEmitter';
import { ReadContext } from '../utils/ReadContext';
import { Service, ServiceData } from './Service';
import { sleep } from '../utils/sleep';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import type { ServiceMessage, Source, DeviceId } from '../types';
import { Socket } from 'net';


const MAGIC_MARKER = 'fltx';
export const CHUNK_SIZE = 4096;

// FIXME: Strongly type this for all possible messages?
type FileTransferData = any;

interface FileTransferServiceData extends ServiceData {
  source?: Source
}

type DeviceSources = {
  [key: string]: Source;
}

enum MessageId {
  TimeCode = 0x0,
  FileStat = 0x1,
  EndOfMessage = 0x2,
  SourceLocations = 0x3,
  FileTransferId = 0x4,
  FileTransferChunk = 0x5,
  Unknown0 = 0x8,
  DeviceShutdown = 0x9,
  RequestSources = 0x7d2,
}

interface FileTransferProgress {
  sizeLeft: number;
  total: number;
  bytesDownloaded: number;
  percentComplete: number;
}

export declare interface FileTransfer {
  on(event: 'fileTransferProgress', listener: (txId: number, progress: FileTransferProgress) => void): this;
  //on(event: 'dbDownloaded', listener: (sourceName: string, dbPath: string) => void): this;
}

export class FileTransfer extends Service<FileTransferData> {
  private receivedFile: WriteContext = null;
  public name: string = "FileTransfer";
  public services: Map<string, FileTransferServiceData> = new Map();
  public sources: Map<string, Source> = new Map();
  private _isAvailable: boolean = true;
  private txId: number = 1;

  public deviceSources: Map<string, DeviceSources> = new Map();

  async init() {}

  public get txid() {
    return this.txId;
  }

  protected parseServiceData(messageId:number, deviceId: DeviceId, serviceName: string, socket: Socket): ServiceMessage<FileTransferData> {
    assert((socket));
    Logger.silly(`${MessageId[messageId]} to ${serviceName} from ${deviceId.toString()}`)
    return
  }

  protected parseData(p_ctx: ReadContext, socket: Socket): ServiceMessage<FileTransferData> {

    const check = p_ctx.getString(4);
    if (check !== MAGIC_MARKER) {
      Logger.error(assert(check === MAGIC_MARKER))
    }

    const txId = p_ctx.readUInt32();

    const messageId: MessageId = p_ctx.readUInt32();
    
    switch (messageId) {
      case MessageId.RequestSources: {
        assert(p_ctx.readUInt32() === 0x0)
        assert(p_ctx.isEOF());
        
        return {
          id: MessageId.RequestSources,
          message: {
            txid: txId,
          },
          socket: socket,
        };
      }

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

        if (sources.length) {
          Logger.silly(`getting sources for `, this.deviceId.toString());
          this.getSources(sources, socket);
        }

        return {
          id: messageId,
          message: {
            txid: txId,
            sources: sources,
            socket: socket,
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
            txid: txId,
          },
          socket: socket,
        };
      }

      case MessageId.EndOfMessage: {
        // End of result indication?

        return {
          id: messageId,
          message: null,
          socket: socket,
        };
      }

      case MessageId.FileTransferId: {
        assert(p_ctx.sizeLeft() === 12);
        assert(p_ctx.readUInt32() === 0x0);
        const filesize = p_ctx.readUInt32();
        const id = p_ctx.readUInt32();
        assert(id === 1)
        return {
          id: messageId,
          socket: socket,
          message: {
            size: filesize,
            txid: txId,
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
          socket: socket,
          message: {
            txid: txId,
            data: p_ctx.readRemainingAsNewBuffer(),
            offset: offset,
            size: chunksize,
          },
        };
      }

      case MessageId.Unknown0: {
        //sizeLeft() of 6 means its not an offline analyzer
        //FIXME actually parse these messages
        //if (p_ctx.sizeLeft() >= 5) {
          //Logger.debug(`requesting sources from `, deviceId.toString());
          this.requestSources(socket);
        //}

        return {
          id: messageId,
          socket: socket,
          message: null,
        };
      }

      case MessageId.DeviceShutdown: {
       // This message seems to be sent from connected devices when shutdown is started
        if (p_ctx.sizeLeft() > 0) {
          const msg = p_ctx.readRemainingAsNewBuffer().toString('hex');
          Logger.debug(msg)
        }

        return {
          id: messageId,
          socket: socket,
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
    this.emit('fileMessage', p_data);
    
    if (p_data && p_data.id === MessageId.FileTransferChunk && this.receivedFile) {
      //assert(this.receivedFile.sizeLeft() >= p_data.message.size);
      this.receivedFile.write(p_data.message.data);
    }
    if (p_data && p_data.id === MessageId.RequestSources) {
      this.sendNoSourcesReply(p_data.socket, p_data);
    }
  }

  /**
   * Reads a file on the device and returns a buffer.
   *
   * >> USE WITH CAUTION! <<
   *
   * Downloading seems eat a lot of CPU on the device and might cause it to
   * be unresponsive while downloading big files. Also, it seems that transfers
   * top out at around 10MB/sec.
   *
   * @param p_location Location of the file on the device.
   * @param socket Socket.
   * @returns Contents of the file.
   */
  async getFile(p_location: string, socket: Socket): Promise<Uint8Array> {
    this._isAvailable = false;
    assert(this.receivedFile === null);
    await this.requestFileTransferId(p_location, socket);
    const txinfo = await this.waitForMessage('fileMessage', MessageId.FileTransferId);
    if (txinfo) {
      this.receivedFile = new WriteContext({ size: txinfo.size });
      const totalChunks = Math.ceil(txinfo.size / CHUNK_SIZE);
      const total = parseInt(txinfo.size);

      if (total === 0) {
        Logger.warn(`${p_location} doesn't exist or is a streaming file`);
        this.receivedFile = null
        this._isAvailable = true;
        return;
      }
      await this.requestChunkRange(1, 0, totalChunks - 1, socket);

      try {
        await new Promise(async (resolve, reject) => {
          setTimeout(() => {
            reject(new Error(`Failed to download '${p_location}'`));
          }, DOWNLOAD_TIMEOUT);

          while (this.receivedFile.isEOF() === false) {
            const bytesDownloaded = total - this.receivedFile.sizeLeft();
            const percentComplete = (bytesDownloaded / total) * 100;
            this.emit('fileTransferProgress', this.txId,{
              sizeLeft: this.receivedFile.sizeLeft(),
              total: txinfo.size,
              bytesDownloaded: bytesDownloaded,
              percentComplete: percentComplete
            })
            //Logger.info(`sizeleft ${this.receivedFile.sizeLeft()} total ${txinfo.size} total ${total}`);
            //Logger.info(`Reading ${p_location} progressComplete=${Math.ceil(percentComplete)}% ${bytesDownloaded}/${total}`);
            await sleep(200);
          }
          Logger.info(`Download complete.`);
          resolve(true);
        });
      } catch (err) {
        const msg = `Could not read database from ${p_location}: ${err.message}`
        this.receivedFile = null
        this._isAvailable = true;
        Logger.error(msg);
        throw new Error(msg);
      }
      
      Logger.debug(`Signaling transfer complete.`);
      await this.signalTransferComplete(socket);
      this.txId++
    }

    const buf = this.receivedFile ? this.receivedFile.getBuffer() : null;
    this.receivedFile = null;
    this._isAvailable = true;
    return buf;
  }

  async getSources(sources: string[], socket: Socket): Promise<Source[]> {
    const result: Source[] = [];
    let devices: DeviceSources = {}

    for (const source of sources) {
      //try to retrieve V2.x Database2/m.db first. If file doesn't exist or 0 size, retrieve V1.x /m.db
      const databases = [`/${source}/Engine Library/Database2/m.db`, `/${source}/Engine Library/m.db`];
      for (const database of databases) {
        await this.requestStat(database, socket);
        const fstatMessage = await this.waitForMessage('fileMessage', MessageId.FileStat);

        if (fstatMessage.size > 0) {

          const thisSource: Source = {
            name: source,
            database: {
              location: database,
              size: fstatMessage.size,
              remote: {
                location: database,
                device: this.deviceId.toString(),
              }
            },
            
          }
          this.sources.set(source, thisSource);
          this.parent.databases.sources.set(source, thisSource);
          result.push(thisSource);

          devices[source] = thisSource;

          break;
        }
      }
    }

    await this.deviceSources.set(this.deviceId.toString(), devices);
    
    this.parent.databases.downloadDb(this.deviceId.toString());

    return result;
  }

  ///////////////////////////////////////////////////////////////////////////
  // Private methods

  private async requestStat(p_filepath: string, socket: Socket): Promise<void> {
    // 0x7d1: seems to request some sort of fstat on a file
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(this.txId);
    ctx.writeUInt32(0x7d1);
    ctx.writeNetworkStringUTF16(p_filepath);
    await this.writeWithLength(ctx, socket);
  }

  private async requestSources(socket: Socket): Promise<void> {
    // 0x7d2: Request available sources
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(this.txId);
    ctx.writeUInt32(0x7d2); // Database query
    ctx.writeUInt32(0x0);
    await this.writeWithLength(ctx, socket);
  }

  private async requestFileTransferId(p_filepath: string, socket: Socket): Promise<void> {
    // 0x7d4: Request transfer id?
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(this.txId);
    ctx.writeUInt32(0x7d4);
    ctx.writeNetworkStringUTF16(p_filepath);
    ctx.writeUInt32(0x0); // Not sure why we need 0x0 here
    await this.writeWithLength(ctx, socket);
  }

  private async requestChunkRange(p_txid: number, p_chunkStartId: number, p_chunkEndId: number, socket: Socket): Promise<void> {
    // 0x7d5: seems to be the code to request chunk range
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(this.txId);
    ctx.writeUInt32(0x7d5);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(p_txid); // I assume this is the transferid
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(p_chunkStartId);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(p_chunkEndId);
    await this.writeWithLength(ctx, socket);
  }

  private async signalTransferComplete(socket: Socket): Promise<void> {
    // 0x7d6: seems to be the code to signal transfer completed
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(this.txId);
    ctx.writeUInt32(0x7d6);
    await this.writeWithLength(ctx, socket);
  }

  // 00000013 666c747 80000009f 00000003 00000000 010100
  private async sendNoSourcesReply(socket: Socket, p_data: FileTransferData) {
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(p_data.message.txid);
    ctx.writeUInt32(0x3);
    ctx.writeUInt32(0x0);
    ctx.writeUInt16(257);
    ctx.writeUInt8(0x0);
    await this.writeWithLength(ctx, socket);
  }

  public async isAvailable(): Promise<void> {
    while (!this._isAvailable) {
      await sleep(250)
    }
  }

}