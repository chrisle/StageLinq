import { DOWNLOAD_TIMEOUT } from '../types';
import { Logger } from '../LogEmitter';
import { ReadContext } from '../utils/ReadContext';
import { Service, ServiceHandler } from './Service';
import { sleep } from '../utils/sleep';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import type { ServiceMessage, Source } from '../types';
import { DeviceId } from '../devices'
import { Socket } from 'net';


const MAGIC_MARKER = 'fltx';
export const CHUNK_SIZE = 4096;

// TODO: Strongly type this for all possible messages?
type FileTransferData = any;

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

export interface FileTransferProgress {
  sizeLeft: number;
  total: number;
  bytesDownloaded: number;
  percentComplete: number;
}

export declare interface FileTransfer {
  on(event: 'fileTransferProgress', listener: (source: Source, fileName: string, txid: number, progress: FileTransferProgress) => void): this;
  on(event: 'fileTransferComplete', listener: (source: Source, fileName: string, txid: number) => void): this;
  on(event: 'newSource', listener: (source: Source) => void): this;
  on(event: 'sourceRemoved', listener: (sourceName: string, deviceId: DeviceId) => void): this;
}

export class FileTransferHandler extends ServiceHandler<FileTransfer> {
  public readonly name = "FileTransfer"

  /**
   * 
   * @param {Service<FileTransfer>} service 
   * @param {DeviceId} deviceId 
   */
  public setupService(service: Service<FileTransferData>, deviceId: DeviceId) {
    const fileTransfer = service as FileTransfer;
    Logger.debug(`Setting up ${fileTransfer.name} for ${deviceId.string}`);
    this.addDevice(deviceId, service);
    fileTransfer.on('fileTransferProgress', (source, fileName, txid, progress) => {
      this.emit('fileTransferProgress', source, fileName, txid, progress);
    });
    fileTransfer.on('fileTransferComplete', (source, fileName, txid) => {
      this.emit('fileTransferComplete', source, fileName, txid);
    });
    fileTransfer.on('newSource', (source: Source) => {
      this.emit('newSource', source);
    });
    fileTransfer.on('sourceRemoved', (name: string, deviceId: DeviceId) => {
      this.emit('sourceRemoved', name, deviceId);
    });
  }
}

export class FileTransfer extends Service<FileTransferData> {
  public name: string = "FileTransfer";

  private receivedFile: WriteContext = null;
  #txid: number = 1;
  #isAvailable: boolean = true;

  // TODO need better txId to handle concurrent transfers
  public get txid() {
    return this.#txid;
  }

  protected parseData(ctx: ReadContext, socket: Socket): ServiceMessage<FileTransferData> {

    const check = ctx.getString(4);
    if (check !== MAGIC_MARKER) {
      Logger.error(assert(check === MAGIC_MARKER))
    }

    const txId = ctx.readUInt32();

    const messageId: MessageId = ctx.readUInt32();

    switch (messageId) {
      case MessageId.RequestSources: {
        assert(ctx.readUInt32() === 0x0)
        assert(ctx.isEOF());

        return {
          id: MessageId.RequestSources,
          deviceId: this.deviceId,
          message: {
            txid: txId,
          },
          socket: socket,
        };
      }

      case MessageId.SourceLocations: {
        const sources: string[] = [];
        const sourceCount = ctx.readUInt32();
        for (let i = 0; i < sourceCount; ++i) {
          // We get a location
          const location = ctx.readNetworkStringUTF16();
          sources.push(location);
        }
        // Final three bytes should be 0x1 0x1 0x1
        assert(ctx.readUInt8() === 0x1);
        assert(ctx.readUInt8() === 0x1);
        assert(ctx.readUInt8() === 0x1);
        assert(ctx.isEOF());

        Logger.silly(`getting sources for `, this.deviceId.string);
        this.updateSources(sources);

        return {
          id: messageId,
          deviceId: this.deviceId,
          socket: socket,
          message: {
            txid: txId,
            sources: sources,
          },
        };
      }

      case MessageId.FileStat: {
        assert(ctx.sizeLeft() === 53);
        // Last 4 bytes (FAT32) indicate size of file
        ctx.seek(49);
        const size = ctx.readUInt32();

        return {
          id: messageId,
          deviceId: this.deviceId,
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
          deviceId: this.deviceId,
          message: null,
          socket: socket,
        };
      }

      case MessageId.FileTransferId: {
        assert(ctx.sizeLeft() === 12);
        assert(ctx.readUInt32() === 0x0);
        const filesize = ctx.readUInt32();
        const id = ctx.readUInt32();
        assert(id === 1)
        return {
          id: messageId,
          deviceId: this.deviceId,
          socket: socket,
          message: {
            size: filesize,
            txid: txId,
          },
        };
      }

      case MessageId.FileTransferChunk: {
        assert(ctx.readUInt32() === 0x0);
        const offset = ctx.readUInt32();
        const chunksize = ctx.readUInt32();
        assert(chunksize === ctx.sizeLeft());
        assert(ctx.sizeLeft() <= CHUNK_SIZE);

        return {
          id: messageId,
          deviceId: this.deviceId,
          socket: socket,
          message: {
            txid: txId,
            data: ctx.readRemainingAsNewBuffer(),
            offset: offset,
            size: chunksize,
          },
        };
      }

      case MessageId.Unknown0: {
        //sizeLeft() of 6 means its not an offline analyzer
        this.requestSources();

        return {
          id: messageId,
          deviceId: this.deviceId,
          socket: socket,
          message: null,
        };
      }

      case MessageId.DeviceShutdown: {
        // This message seems to be sent from connected devices when shutdown is started
        if (ctx.sizeLeft() > 0) {
          const msg = ctx.readRemainingAsNewBuffer().toString('hex');
          Logger.debug(msg)
        }

        return {
          id: messageId,
          deviceId: this.deviceId,
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

  protected messageHandler(data: ServiceMessage<FileTransferData>): void {
    this.emit('fileMessage', data);
    if (data && data.id === MessageId.FileTransferChunk && this.receivedFile) {
      this.receivedFile.write(data.message.data);
    }
    if (data && data.id === MessageId.RequestSources) {
      this.sendNoSourcesReply(data);
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
   * @param {string} location Location of the file on the device.
   * @returns {Promise<Uint8Array>} Contents of the file.
   */
  async getFile(source: Source, location: string): Promise<Uint8Array> {
    while (!this.#isAvailable) {
      await sleep(500)
    }
    this.#isAvailable = false;
    assert(this.receivedFile === null);
    await this.requestFileTransferId(location);
    const txinfo = await this.waitForMessage('fileMessage', MessageId.FileTransferId);
    if (txinfo) {
      this.receivedFile = new WriteContext({ size: txinfo.size });
      const totalChunks = Math.ceil(txinfo.size / CHUNK_SIZE);
      const total = parseInt(txinfo.size);

      if (total === 0) {
        Logger.warn(`${location} doesn't exist or is a streaming file`);
        this.receivedFile = null
        this.#isAvailable = true;
        return;
      }
      await this.requestChunkRange(1, 0, totalChunks - 1);

      try {
        await new Promise(async (resolve, reject) => {
          setTimeout(() => {
            reject(new Error(`Failed to download '${location}'`));
          }, DOWNLOAD_TIMEOUT);

          while (this.receivedFile.isEOF() === false) {
            const bytesDownloaded = total - this.receivedFile.sizeLeft();
            const percentComplete = (bytesDownloaded / total) * 100;
            this.emit('fileTransferProgress', source, location.split('/').pop(), this.txid, {
              sizeLeft: this.receivedFile.sizeLeft(),
              total: txinfo.size,
              bytesDownloaded: bytesDownloaded,
              percentComplete: percentComplete
            })
            Logger.silly(`sizeleft ${this.receivedFile.sizeLeft()} total ${txinfo.size} total ${total}`);
            Logger.silly(`Reading ${location} progressComplete=${Math.ceil(percentComplete)}% ${bytesDownloaded}/${total}`);
            await sleep(200);
          }
          Logger.debug(`Download complete.`);
          this.emit('fileTransferComplete', source, location.split('/').pop(), this.#txid)
          resolve(true);
        });
      } catch (err) {
        const msg = `Could not read database from ${location}: ${err.message}`
        this.receivedFile = null
        this.#isAvailable = true;
        Logger.error(msg);
        throw new Error(msg);
      }

      Logger.debug(`Signaling transfer complete.`);
      await this.signalTransferComplete();
      this.#txid++
    }

    const buf = this.receivedFile ? this.receivedFile.getBuffer() : null;
    this.receivedFile = null;
    this.#isAvailable = true;
    return buf;
  }

  /**
   * Gets new sources and deletes those which have been removed
   * @param {string[]} sources  an array of current sources from device
   */
  async updateSources(sources: string[]) {
    const currentSources = this.parent.sources.getSources(this.deviceId);
    const currentSourceNames = currentSources.map(source => source.name);

    //When a source is disconnected, devices send a new SourceLocations message that excludes the removed source
    const markedForDelete = currentSources.filter(item => !sources.includes(item.name));
    const newSources = sources.filter(source => !currentSourceNames.includes(source));
    for (const source of markedForDelete) {
      this.parent.sources.deleteSource(source.name, source.deviceId)
      this.emit('sourceRemoved', source.name, source.deviceId);
    }

    if (newSources.length) {
      this.getSources(newSources);
    }
  }

  /**
   * Get Sources from Device
   * @param {sources[]} sources Array of sources
   */
  async getSources(sources: string[]) {
    const result: Source[] = [];

    for (const source of sources) {
      //try to retrieve V2.x Database2/m.db first. If file doesn't exist or 0 size, retrieve V1.x /m.db
      const databases = [`/${source}/Engine Library/Database2/m.db`, `/${source}/Engine Library/m.db`];
      for (const database of databases) {
        await this.requestStat(database);
        const fstatMessage = await this.waitForMessage('fileMessage', MessageId.FileStat);

        if (fstatMessage.size > 0) {

          const thisSource: Source = {
            name: source,
            deviceId: this.deviceId,
            service: this,
            database: {
              location: database,
              size: fstatMessage.size,
              remote: {
                location: database,
                device: this.deviceId.string,
              }
            }
          }
          this.parent.sources.setSource(thisSource);
          this.emit('newSource', thisSource);
          result.push(thisSource);

          if (this.parent.options.downloadDbSources) {
            this.parent.databases.downloadDb(thisSource);
          }
          break;
        }
      }
    }
  }

  ///////////////////////////////////////////////////////////////////////////
  // Private methods

  /**
   * Request fstat on file from Device
   * @param {string} filepath 
   */
  private async requestStat(filepath: string): Promise<void> {
    // 0x7d1: seems to request some sort of fstat on a file
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(this.#txid);
    ctx.writeUInt32(0x7d1);
    ctx.writeNetworkStringUTF16(filepath);
    await this.writeWithLength(ctx);
  }

  /**
   * Request current sources attached to device
   */
  private async requestSources(): Promise<void> {
    // 0x7d2: Request available sources
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(this.#txid);
    ctx.writeUInt32(0x7d2); // Database query
    ctx.writeUInt32(0x0);
    await this.writeWithLength(ctx);
  }

  /**
   * Request TxId for file
   * @param {string} filepath 
   */
  private async requestFileTransferId(filepath: string): Promise<void> {
    // 0x7d4: Request transfer id?
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(this.#txid);
    ctx.writeUInt32(0x7d4);
    ctx.writeNetworkStringUTF16(filepath);
    ctx.writeUInt32(0x0); // Not sure why we need 0x0 here
    await this.writeWithLength(ctx);
  }

  /**
   * 
   * @param {number} txid Transfer ID for this session
   * @param {number} chunkStartId 
   * @param {number} chunkEndId 
   */
  private async requestChunkRange(txid: number, chunkStartId: number, chunkEndId: number): Promise<void> {
    // 0x7d5: seems to be the code to request chunk range
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(this.#txid);
    ctx.writeUInt32(0x7d5);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(txid);  //TODO This isn't txid is it?
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(chunkStartId);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(chunkEndId);
    await this.writeWithLength(ctx);
  }

  /**
   * Signal Transfer Completed
   */
  private async signalTransferComplete(): Promise<void> {
    // 0x7d6: seems to be the code to signal transfer completed
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(this.#txid);
    ctx.writeUInt32(0x7d6);
    await this.writeWithLength(ctx);
  }

  /**
   * Reply to Devices requesting our sources
   * @param {FileTransferData} data 
   */
  private async sendNoSourcesReply(data: FileTransferData) {
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(data.message.txid);
    ctx.writeUInt32(0x3);
    ctx.writeUInt32(0x0);
    ctx.writeUInt16(257);
    ctx.writeUInt8(0x0);
    await this.writeWithLength(ctx);
  }

  /**
   * Promise will resolve when service is available
   */
  public async isAvailable(): Promise<void> {
    while (!this.#isAvailable) {
      await sleep(250)
    }
  }

}