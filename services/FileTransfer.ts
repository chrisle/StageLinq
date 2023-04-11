import { EventEmitter } from 'events';
import { strict as assert } from 'assert';
import { Logger } from '../LogEmitter';
import { ReadContext, WriteContext, sleep } from '../utils';
import { Service } from './Service';
import type { ServiceMessage } from '../types';
import { Database, Source } from '../Sources'
import { DeviceId } from '../devices'
import { StageLinq } from '../StageLinq';

const MESSAGE_TIMEOUT = 5000; // in ms
const DOWNLOAD_TIMEOUT = 60000; // in ms
const MAGIC_MARKER = 'fltx';
const CHUNK_SIZE = 4096;

export interface FileTransferData {
  service: FileTransfer;
  deviceId: DeviceId;
  txid: number;
  size?: number;
  offset?: number;
  sources?: string[];
  data?: Buffer;
}

enum MessageId {
  TimeCode = 0x0,
  FileStat = 0x1,
  EndOfMessage = 0x2,
  SourceLocations = 0x3,
  FileTransferId = 0x4,
  FileTransferChunk = 0x5,
  DataUpdate = 0x6,
  Unknown0 = 0x8,
  DeviceShutdown = 0x9,
  RequestSources = 0x7d2,
  WalOn = 0x1,
  WalOff = 0x0,
}

enum Action {
  RequestStat = 0x7d1,
  RequestSources = 0x7d2,
  Unknown1 = 0x7d3,
  RequestFileTransferId = 0x7d4,
  RequestChunkRange = 0x7d5,
  TransferComplete = 0x7d6,
  WalMode = 0x7d9,
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
}


export class FileTransfer extends Service<FileTransferData> {
  public name: string = "FileTransfer";
  private receivedFile: WriteContext = null;
  static readonly emitter: EventEmitter = new EventEmitter();
  static #txid: number = 2;
  #isAvailable: boolean = true;

  constructor(deviceId?: DeviceId) {
    super(deviceId)
    this.addListener('newDevice', (service: FileTransfer) => FileTransfer.fileTransferListener('newDevice', service))
    this.addListener('newSource', (source: Source) => FileTransfer.fileTransferListener('newSource', source))
    this.addListener('sourceRemoved', (name: string, deviceId: DeviceId) => FileTransfer.fileTransferListener('newSource', name, deviceId))
    this.addListener('fileTransferProgress', (source: Source, fileName: string, txid: number, progress: FileTransferProgress) => FileTransfer.fileTransferListener('fileTransferProgress', source, fileName, txid, progress))
    this.addListener('fileTransferComplete', (source: Source, fileName: string, txid: number) => FileTransfer.fileTransferListener('fileTransferComplete', source, fileName, txid))
  }

  private get newTxid() {
    const txid = parseInt(FileTransfer.#txid.toString())
    FileTransfer.#txid++
    return txid;
  }

  private static fileTransferListener(eventName: string, ...args: any) {
    FileTransfer.emitter.emit(eventName, ...args)
  }

  protected parseData(ctx: ReadContext): ServiceMessage<FileTransferData> {

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
          message: {
            service: this,
            deviceId: this.deviceId,
            txid: txId,
          },
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

        // Final three bytes should be 0x1 0x1 0x1 for Sources, 0x1 0x1 0x0 for dir/ls
        const signOff = ctx.read(3);
        assert(ctx.isEOF());
        Logger.silly(`getting sources for `, this.deviceId.string);
        if (signOff[2] === 1) {
          this.updateSources(sources);
        }

        return {
          id: messageId,
          message: {
            service: this,
            deviceId: this.deviceId,
            txid: txId,
            sources: sources,
          },
        };
      }

      case MessageId.FileStat: {
        assert(ctx.sizeLeft() === 53);
        // Last 4 bytes (FAT32) indicate size of file
        ctx.seek(49)
        const size = ctx.readUInt32();

        return {
          id: messageId,
          message: {
            service: this,
            deviceId: this.deviceId,
            txid: txId,
            size: size,
          },
        };
      }

      case MessageId.EndOfMessage: {
        // End of result indication?
        return {
          id: messageId,
          message: {
            service: this,
            deviceId: this.deviceId,
            txid: txId,
          },
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
          message: {
            service: this,
            deviceId: this.deviceId,
            txid: txId,
            size: filesize,
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
          message: {
            service: this,
            deviceId: this.deviceId,
            txid: txId,
            data: ctx.readRemainingAsNewBuffer(),
            offset: offset,
            size: chunksize,
          },
        };
      }

      case MessageId.DataUpdate: {
        return {
          id: messageId,
          message: {
            service: this,
            deviceId: this.deviceId,
            txid: txId,
            data: ctx.readRemainingAsNewBuffer(),
          },
        };
      }

      case MessageId.Unknown0: {
        //sizeLeft() of 6 means its not an offline analyzer
        this.requestSources(1);

        return {
          id: messageId,
          message: {
            service: this,
            deviceId: this.deviceId,
            txid: txId,
          },
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
          message: {
            service: this,
            deviceId: this.deviceId,
            txid: txId,
          },
        };
      }

      default:
        {
          const remaining = ctx.readRemainingAsNewBuffer()
          Logger.error(`File Transfer Unhandled message id '${messageId}'`, remaining.toString('hex'));
        }
        break;
    }
  }

  protected messageHandler(data: ServiceMessage<FileTransferData>): void {
    if (data && data.id && data.id !== MessageId.FileTransferChunk) {
      const msgData = { ...data.message }
      delete msgData.service
      delete msgData.deviceId
      if (msgData.data) {
        delete msgData.data
      }
      Logger.silly(data.message.deviceId.string, MessageId[data.id], msgData)
    }


    if (data.id === MessageId.DataUpdate) {
      // console.warn(`[DataUpdate]`, data.message.data.toString('hex'))
    }

    this.emit('fileMessage', data);
    if (data && data.id === MessageId.FileTransferChunk && this.receivedFile) {
      this.receivedFile.write(data.message.data);
    }
    if (data && data.id === Action.RequestSources) {
      this.sendNoSourcesReply(data.message);
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
  async getFile(source: Source, location: string, _transfer?: Transfer): Promise<Uint8Array> {

    const transfer = _transfer || new Transfer(source, location, this.newTxid)


    await this.isAvailable();
    this.#isAvailable = false;
    assert(this.receivedFile === null);
    await this.requestFileTransferId(location, transfer.txid);
    const txinfo = await this.waitForFileMessage('fileMessage', MessageId.FileTransferId, transfer.txid);
    if (txinfo) {
      this.receivedFile = new WriteContext({ size: txinfo.size });
      const totalChunks = Math.ceil(txinfo.size / CHUNK_SIZE);
      const total = txinfo.size;

      if (total === 0) {
        Logger.warn(`${location} doesn't exist or is a streaming file`);
        this.receivedFile = null
        this.#isAvailable = true;
        return;
      }
      await this.requestChunkRange(transfer.txid, 0, totalChunks - 1);

      try {
        await new Promise(async (resolve, reject) => {
          setTimeout(() => {
            reject(new Error(`Failed to download '${location}'`));
          }, DOWNLOAD_TIMEOUT);

          while (this.receivedFile.isEOF() === false) {
            const bytesDownloaded = total - this.receivedFile.sizeLeft();
            const percentComplete = (bytesDownloaded / total) * 100;
            this.emit('fileTransferProgress', source, location.split('/').pop(), transfer.txid, {
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
          this.emit('fileTransferComplete', source, location.split('/').pop(), transfer.txid)
          resolve(true);
        });
      } catch (err) {
        const msg = `Could not read database from ${location}: ${err.message}`
        this.receivedFile = null
        this.#isAvailable = true;
        Logger.error(msg);
        throw new Error(msg);
      }

      if (!_transfer) {
        Logger.info(`Signaling transfer complete.`);
        await this.signalTransferComplete(transfer.txid);
      }
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
  private async updateSources(sources: string[]) {
    const currentSources = StageLinq.sources.getSources(this.deviceId);
    const currentSourceNames = currentSources.map(source => source.name);

    //When a source is disconnected, devices send a new SourceLocations message that excludes the removed source
    const markedForDelete = currentSources.filter(item => !sources.includes(item.name));
    const newSources = sources.filter(source => !currentSourceNames.includes(source));
    for (const source of markedForDelete) {
      StageLinq.sources.deleteSource(source.name, source.deviceId)

    }
    if (newSources.length) {
      this.getSources(newSources);
    }
  }

  /**
   * Get Sources from Device
   * @param {sources[]} sources Array of sources
   */
  private async getSources(sources: string[]) {
    const result: Source[] = [];


    for (const source of sources) {
      //try to retrieve V2.x Database2/m.db first. If file doesn't exist or 0 size, retrieve V1.x /m.db

      const thisSource: Source = {
        name: source,
        deviceId: this.deviceId,
        service: this,
        databases: [],
        dbFiles: ['m.db']
      }

      for (const database of thisSource.dbFiles) {
        const dbPath = `/${source}/Engine Library/Database2`
        const _transfer = new Transfer(thisSource, `${dbPath}/${database}`, this.newTxid)
        await this.swapWalMode(1, _transfer.txid);
        await this.requestStat(_transfer.filepath, _transfer.txid);
        const fstatMessage = await this.waitForFileMessage('fileMessage', MessageId.FileStat, _transfer.txid);

        if (fstatMessage.size > 126976) {

          const db = new Database(database, fstatMessage.size, dbPath, _transfer.source, _transfer)

          console.log(`{${_transfer.txid}} file: ${db.remoteDBPath} size: ${db.size}`)
          thisSource.databases.push(db)

          await this.signalMessageComplete(_transfer.txid)
        } else {
          await this.signalMessageComplete(_transfer.txid)
        }
      }
      StageLinq.sources.setSource(thisSource);

      this.emit('newSource', thisSource)
      result.push(thisSource);

      if (StageLinq.options.downloadDbSources) {
        await StageLinq.sources.downloadDbs(thisSource);
      }
    }
  }

  async getSourceDirInfo(source: Source) {
    const dbPath = `/${source.name}/Engine Library/Database2`
    const transfer = new Transfer(source, dbPath, this.newTxid)
    let returnList: string[][] = [];
    try {
      await this.requestPathInfo(transfer.filepath, transfer.txid);
      const dbFileList = await this.waitForFileMessage('fileMessage', MessageId.SourceLocations, transfer.txid);
      console.log(`Contents of ${transfer.filepath}`, dbFileList.sources);
      for (const file of dbFileList.sources) {
        const _transfer = new Transfer(source, `${dbPath}/${file}`, this.newTxid)
        await this.requestStat(_transfer.filepath, _transfer.txid);
        const fstatMessage = await this.waitForFileMessage('fileMessage', MessageId.FileStat, _transfer.txid);
        returnList.push([_transfer.txid.toString(), file, fstatMessage.size.toString()])
      }
    } catch (err) {
      console.log(err)
    }
    console.log(returnList);
  }

  ///////////////////////////////////////////////////////////////////////////
  // Private methods

  private async waitForFileMessage(eventMessage: string, messageId: number, txid: number): Promise<FileTransferData> {
    return await new Promise((resolve, reject) => {
      const listener = (message: ServiceMessage<FileTransferData>) => {
        if (message.id === messageId && message.message?.txid === txid) {
          this.removeListener(eventMessage, listener);
          resolve(message.message);
        }
      };
      this.addListener(eventMessage, listener);
      setTimeout(() => {
        reject(new Error(`Failed to receive message '${messageId}' on time`));
      }, MESSAGE_TIMEOUT);
    });
  }


  /**
   * Request fstat on file from Device
   * @param {string} filepath 
   */
  private async requestStat(filepath: string, txid: number): Promise<void> {
    // 0x7d1: seems to request some sort of fstat on a file
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(txid);
    ctx.writeUInt32(0x7d1);
    ctx.writeNetworkStringUTF16(filepath);
    await this.writeWithLength(ctx);
  }

  /**
   * Request current sources attached to device
   */
  private async requestSources(txid: number): Promise<void> {
    // 0x7d2: Request available sources
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(txid);
    ctx.writeUInt32(0x7d2); // Database query
    ctx.writeUInt32(0x0);
    await this.writeWithLength(ctx);
  }

  async requestPathInfo(path: string, txid: number): Promise<void> {
    // 0x7d2: Request available sources
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(txid);
    ctx.writeUInt32(0x7d2); // Database query
    ctx.writeNetworkStringUTF16(path)
    await this.writeWithLength(ctx);
  }

  /**
   * Request TxId for file
   * @param {string} filepath 
   */
  private async requestFileTransferId(filepath: string, txid: number): Promise<void> {
    // 0x7d4: Request transfer id?
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(txid);
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
    ctx.writeUInt32(txid);
    ctx.writeUInt32(0x7d5);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(0x1);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(chunkStartId);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(chunkEndId);
    await this.writeWithLength(ctx);
  }

  /**
   * Signal Transfer Completed
   */
  private async signalTransferComplete(txid: number): Promise<void> {
    // 0x7d6: seems to be the code to signal transfer completed
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(txid);
    ctx.writeUInt32(0x7d6);
    await this.writeWithLength(ctx);
  }

  private async signalMessageComplete(txid: number): Promise<void> {
    // 0x7d6: seems to be the code to signal transfer completed
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(txid);
    ctx.writeUInt32(0x7d3);
    await this.writeWithLength(ctx);
  }
  /**
   * Reply to Devices requesting our sources
   * @param {FileTransferData} data 
   */
  private async sendNoSourcesReply(message: FileTransferData) {
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(message.txid);
    ctx.writeUInt32(0x3);
    ctx.writeUInt32(0x0);
    ctx.writeUInt16(257);
    ctx.writeUInt8(0x0);
    await this.writeWithLength(ctx);
  }

  private async swapWalMode(action: 0 | 1, txid: number): Promise<void> {
    // 0x7d9: swap Wal Mode?
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(txid);
    ctx.writeUInt32(0x7d9);
    ctx.writeInt32(action);
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

export class Transfer {
  static readonly emitter: EventEmitter = new EventEmitter();
  #txid: number;
  source: Source = null;
  filepath: string = null;

  constructor(source: Source, filepath: string, txid: number) {
    this.source = source;
    this.filepath = filepath
    this.#txid = txid;
  }

  get txid() {
    return this.#txid
  }
}