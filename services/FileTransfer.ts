import { DOWNLOAD_TIMEOUT } from '../types';
import { Logger } from '../LogEmitter';
import { ReadContext } from '../utils/ReadContext';
import { Service, ServiceData } from './Service';
import { sleep } from '../utils/sleep';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import type { ServiceMessage, Source, DeviceId } from '../types';
import { deviceIdFromBuff } from '../types';
import { Socket, AddressInfo } from 'net';
import { getTempFilePath } from '../utils';
import * as fs from 'fs';

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

function fastForward(ctx: ReadContext, targetString: string, msgId: number): ReadContext {
  
  assert(targetString.length % 2 === 0);
  const shiftLeft = (collection:Uint8Array, value:any) => {
    for (let i = 0; i < collection.length - 1; i++) {
      collection[i] = collection[i + 1]; // Shift left
    }
    collection[collection.length - 1] = value; // Place new value at tail
    return collection;
  }

  const ctxSize = ctx.sizeLeft();
  const bufferSize = (targetString.length / 2);
  let checkBufferArray = new Uint8Array(bufferSize);
  checkBufferArray.fill(0);
  let count = 0;

  while (Buffer.from(checkBufferArray).toString('hex') !== targetString) {
    shiftLeft(checkBufferArray, ctx.read(1));
    count++
    if (ctx.isEOF()) {
      ctx.seek(0-ctxSize)
      Logger.debug(`[${msgId}] fastForwarded checked ${count} bytes, returned original`);
      return ctx
    }
  } 
  ctx.seek(0-bufferSize);
  if (count !== bufferSize) {
    Logger.debug(`[${msgId}] fastForwarded ${count} bytes`);
  }
  return ctx
};


export class FileTransfer extends Service<FileTransferData> {
  private receivedFile: WriteContext = null;
  public name: string = "FileTransfer";
  public services: Map<string, FileTransferServiceData> = new Map();
  public sources: Map<string, Source> = new Map();
  
  public deviceSources: Map<string, DeviceSources> = new Map();

  async init() {}
  
  /*
  protected parseServiceData(p_ctx: ReadContext, socket?: Socket, msgId?: number,isSub?:boolean): ServiceMessage<FileTransferData> {
    
      //console.log(msgId, checkSvcReq);
      const _msgId = p_ctx.readUInt32();
      const token = p_ctx.read(16);

      //if (this.parent.peers.has(deviceIdFromBuff(token))) {
        const svcName = p_ctx.readNetworkStringUTF16();
        const svcPort = p_ctx.readUInt16();
        const length = p_ctx.readUInt32();
        const deviceId = deviceIdFromBuff(token);
        this.deviceIds.set(deviceId,[socket.remoteAddress,socket.remotePort].join(":"));
        this.deviceIps.set([socket.remoteAddress,socket.remotePort].join(":"), deviceId);
        
        const thisDevice: FileTransferServiceData = {
          deviceId: deviceId,
          socket: socket,
          service: this
        }
        this.services.set(deviceId, thisDevice);
        
        console.log(`[${msgId}] `,deviceId, svcName, svcPort);
      //} else {
      //  p_ctx.seek(-20);
      //}
      return
  }
  */
  protected parseServiceData(messageId:number, deviceId: DeviceId, serviceName: string, socket: Socket, msgId?: number,isSub?:boolean): ServiceMessage<StateData> {
    Logger.debug(`${MessageId[messageId]} to ${serviceName} from ${deviceId.toString()}`)
    //assert((this.p))
    //this.subscribe(socket);
    return
  }

  protected parseData(p_ctx: ReadContext, socket: Socket, msgId:number, svcMsg?: boolean): ServiceMessage<FileTransferData> {
    
    const ipAddressPort = [socket.remoteAddress, socket.remotePort].join(':');
    const deviceId = this.peerDeviceIds[ipAddressPort];

   // this.testPoint(p_ctx, this.getDeviceIdFromSocket(socket), msgId, "preSvc", true);  
    
    //test if this is a serviceRequest
    
    //const checkSvcReq = p_ctx.readUInt32();
    
    //if (p_ctx.sizeLeft() === 88 && checkSvcReq === 0) {
    //console.warn(p_ctx.sizeLeft());
    /*
    if (svcMsg) {
      //console.log(msgId, checkSvcReq);
      const _msgId = p_ctx.readUInt32();
      const token = p_ctx.read(16);

      if (this.parent.peers.has(deviceIdFromBuff(token))) {
        const svcName = p_ctx.readNetworkStringUTF16();
        const svcPort = p_ctx.readUInt16();
        const length = p_ctx.readUInt32();
        const deviceId = deviceIdFromBuff(token);
        this.deviceIds.set(deviceId,[socket.remoteAddress,socket.remotePort].join(":"));
        this.deviceIps.set([socket.remoteAddress,socket.remotePort].join(":"), deviceId);
        
        const thisDevice: FileTransferServiceData = {
          deviceId: deviceId,
          socket: socket,
          service: this
        }
        this.services.set(deviceId, thisDevice);
        
        console.log(`[${msgId}] `,deviceId, svcName, svcPort);
      } else {
        p_ctx.seek(-20);
      }
    } //else {
      */
      //p_ctx.seek(-4);
    //}
   // this.testPoint(p_ctx, this.getDeviceIdFromSocket(socket), msgId, "postSvc", true);  

    /*
    let checkBufferArray = new Uint8Array([0,0,0,0])

    const shiftLeft = (collection:Uint8Array, value:any) => {
      for (let i = 0; i < collection.length - 1; i++) {
        collection[i] = collection[i + 1]; // Shift left
      }
      collection[collection.length - 1] = value; // Place new value at tail
      return collection;
    }

    let checkString = "";
  
   while (checkString !== "666c7478") {
      shiftLeft(checkBufferArray, p_ctx.read(1));
      checkString = Buffer.from(checkBufferArray).toString('hex');
      if (p_ctx.isEOF()) {
        return
      }
    } 
    p_ctx.seek(-4);
    */

    //this.testPoint(p_ctx, dev, msgId, "ff-pre", true );
    //if (p_ctx.sizeLeft() < 100) {
    //  p_ctx = fastForward(p_ctx, "666c7478", msgId);
    //}
    
    
    const check = p_ctx.getString(4);
    //this.testPoint(p_ctx, this.getDeviceIdFromSocket(socket), msgId, "mag-post", true );
    if (check !== MAGIC_MARKER) {
      Logger.error(msgId,svcMsg, assert(check === MAGIC_MARKER))
    }

    let code = p_ctx.readUInt32();

    // If first 4 bytes are non-zero, a timecode is sent
    if (code > 0) {
      assert(p_ctx.sizeLeft() === 8);
      const id = p_ctx.readUInt32();
      assert(id === 0x07d2);
      assert(p_ctx.readUInt32() === 0);
      //console.log(MessageId[id]);
      return {
        id: MessageId.TimeCode,
        message: {
          timecode: code,
        },
        socket: socket,
      };
    }

   // p_ctx = this.testPoint(p_ctx, this.getDeviceIdFromSocket(socket), msgId, "id" );  

    // Else
    const messageId: MessageId = p_ctx.readUInt32();
    //console.log(`[${msgId}] `,MessageId[messageId], messageId);
    //console.log(`[${msgId}] `,deviceId.toString(), ' MessageID: ', MessageId[messageId]);
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
        
        if (sources.length) {
          Logger.debug(`getting sources for `, deviceId.toString());
          this.getSources(sources, socket);
        }

        return {
          id: messageId,
          message: {
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

        return {
          id: messageId,
          socket: socket,
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
          socket: socket,
          message: {
            data: p_ctx.readRemainingAsNewBuffer(),
            offset: offset,
            size: chunksize,
          },
        };
      }

      case MessageId.Unknown0: {
        
        if (p_ctx.sizeLeft() >= 5) {
        
          Logger.debug(`requesting sources from `, deviceId.toString());
          this.requestSources(socket);

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
    if (p_data && p_data.id === MessageId.FileTransferChunk && this.receivedFile) {
      assert(this.receivedFile.sizeLeft() >= p_data.message.size);
      this.receivedFile.write(p_data.message.data);
    } else {
      // Logger.log(p_data);
    }
  }

  async getFile(p_location: string, socket: Socket): Promise<Uint8Array> {
    assert(this.receivedFile === null);

    await this.requestFileTransferId(p_location, socket);
    const txinfo = await this.waitForMessage(MessageId.FileTransferId);

    if (txinfo) {
      //Logger.info(`heard ${txinfo}`);
      this.receivedFile = new WriteContext({ size: txinfo.size });

      const totalChunks = Math.ceil(txinfo.size / CHUNK_SIZE);
      const total = parseInt(txinfo.size);

      if (total === 0) {
        Logger.warn(`${p_location} doesn't exist or is a streaming file`);
        return;
      }

      await this.requestChunkRange(txinfo.txid, 0, totalChunks - 1, socket);

      try {
        await new Promise(async (resolve, reject) => {
          setTimeout(() => {
            reject(new Error(`Failed to download '${p_location}'`));
          }, DOWNLOAD_TIMEOUT);

          while (this.receivedFile.isEOF() === false) {
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
      await this.signalTransferComplete(socket);
    }

    const buf = this.receivedFile ? this.receivedFile.getBuffer() : null;
    this.receivedFile = null;
    return buf;
  }
/*
export interface Source {
	name: string;
	database: {
		location: string;
		size: number;
	};
}
*/

/*
  async getSources( socket: Socket): Promise<Source[]> {
    const result: Source[] = [];


    await this.requestSourcesOrig(socket);
    const message = await this.waitForMessage(MessageId.SourceLocations);
    //console.log('message ', message);
    if (message) {
      
      const msgDeviceId = (message.socket) ? this.getDeviceIdFromSocket(message.socket) : "noSocket"
      //console.log('message ', msgDeviceId, message);
      for (const source of message.sources) {
        Logger.info('getSource source: ', source);
        //try to retrieve V2.x Database2/m.db first. If file doesn't exist or 0 size, retrieve V1.x /m.db
        const databases = [`/${source}/Engine Library/Database2/m.db`, `/${source}/Engine Library/m.db`];
        for (const database of databases) {
          await this.requestStat(database, socket);
          const fstatMessage = await this.waitForMessage(MessageId.FileStat);
          const deviceId = this.getDeviceIdFromSocket(socket);
          if (fstatMessage.size > 0) {
            result.push({
              name: source,
              database: {
                location: database,
                size: fstatMessage.size,
              },
            
            
            });
            //const data = this.serviceList.get(deviceId);
            const thisDevice: FileTransferServiceData = {
              deviceId: deviceId,
              socket: socket,
              service: this,
              source: {
                name: source,
                database: {
                  location: database,
                  size: fstatMessage.size                
                }
              }
            }
            //Logger.debug(thisDevice);
            this.services.set(deviceId, thisDevice);
            this.sources.set(deviceId, thisDevice);
            await sleep(500);
            this.downloadDb(deviceId);
            break;
          }
        }
      }
    }

    return result;
  }
  */
  

  async getSources(sources: string[], socket: Socket): Promise<Source[]> {
    const result: Source[] = [];
    let devices: DeviceSources = {}


    //await this.requestSources(socket);
    //const message = await this.waitForMessage(MessageId.SourceLocations);
    //console.log('message ', message);
    //if (message) {
      
      const msgDeviceId = this.getDeviceIdFromSocket(socket);// : "noSocket"
      //console.log('message ', msgDeviceId, message.sources);
      for (const source of sources) {
        //Logger.info('getSource source: ', source);
        //try to retrieve V2.x Database2/m.db first. If file doesn't exist or 0 size, retrieve V1.x /m.db
        const databases = [`/${source}/Engine Library/Database2/m.db`, `/${source}/Engine Library/m.db`];
        for (const database of databases) {
          await this.requestStat(database, socket);
          const fstatMessage = await this.waitForMessage(MessageId.FileStat);
          const deviceId = this.getDeviceIdFromSocket(socket);
          if (fstatMessage.size > 0) {
            
            const thisSource: Source = {
              name: source,
              database: {
                location: database,
                size: fstatMessage.size,
              }
            }

            result.push(thisSource);
            //const data = this.serviceList.get(deviceId);
            /*
            const thisDevice: FileTransferServiceData = {
              deviceId: deviceId,
              socket: socket,
              service: this,
              source: {
                name: source,
                database: {
                  location: database,
                  size: fstatMessage.size                
                }
              }
            }
            */
            //Logger.debug(thisDevice);
            //this.services.set(deviceId, thisDevice);
            this.sources.set(deviceId, thisSource);
            devices[source] = thisSource;
            //await sleep(500);
            //this.downloadDb(deviceId);
            break;
          }
        }
      }
   //}
    await this.deviceSources.set(msgDeviceId, devices);
    await sleep(500);
    this.downloadDb(msgDeviceId, socket);
    const testDev = this.deviceSources.get(msgDeviceId);
    Logger.info(testDev);
    return result;
  }

  ///////////////////////////////////////////////////////////////////////////
  // Private methods

  private async requestStat(p_filepath: string, socket: Socket): Promise<void> {
    // 0x7d1: seems to request some sort of fstat on a file
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(0x7d1);
    ctx.writeNetworkStringUTF16(p_filepath);
    await this.writeWithLength(ctx, socket);
  }

  private async requestSources(socket: Socket): Promise<void> {
    // 0x7d2: Request available sources
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(0x7d2); // Database query
    ctx.writeUInt32(0x0);
    await this.writeWithLength(ctx, socket);
  }

  private async requestFileTransferId(p_filepath: string, socket: Socket): Promise<void> {
    // 0x7d4: Request transfer id?
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(0x7d4);
    ctx.writeNetworkStringUTF16(p_filepath);
    ctx.writeUInt32(0x0); // Not sure why we need 0x0 here
    await this.writeWithLength(ctx, socket);
  }

  private async requestChunkRange(p_txid: number, p_chunkStartId: number, p_chunkEndId: number, socket: Socket): Promise<void> {
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
    await this.writeWithLength(ctx, socket);
  }

  private async signalTransferComplete(socket: Socket): Promise<void> {
    // 0x7d6: seems to be the code to signal transfer completed
    const ctx = new WriteContext();
    ctx.writeFixedSizedString(MAGIC_MARKER);
    ctx.writeUInt32(0x0);
    ctx.writeUInt32(0x7d6);
    await this.writeWithLength(ctx, socket);
  }

  async downloadDb(deviceId: string, socket: Socket) { // sourceId: string, service: FileTransfer, _source: Source) {
    //console.info(source);
    Logger.info(`downloadDb request for ${deviceId}`);
    const deviceSources = this.deviceSources.get(deviceId);
   // const service = this.services.get(deviceId)
   
   for (const sourceName in deviceSources) {
    
    const source = deviceSources[sourceName];
    const dbPath = getTempFilePath(`${deviceId}/${sourceName}/m.db`);
   
    Logger.debug(`Reading database ${deviceId}/${source.name}`);
    this.emit('dbDownloading', deviceId, dbPath);

    //this.on('fileTransferProgress', (progress) => {
      //this.emit('fileTransferProgress', deviceId, progress.total, progress.bytesDownloaded, progress.percentComplete);
     // Logger.debug('fileTransferProgress', deviceId, progress.total, progress.bytesDownloaded, progress.percentComplete);
    //});
    
    // Save database to a file
    const file = await this.getFile(source.database.location, socket);
    Logger.debug(`Saving ${deviceId}/${sourceName} to ${dbPath}`);
    fs.writeFileSync(dbPath, Buffer.from(file));

    Logger.debug(`Downloaded ${deviceId}/${sourceName} to ${dbPath}`);
    this.emit('dbDownloaded', deviceId, dbPath);
  }
   
}
    
/*
  getDbPath(dbSourceName?: string) {
    if (!this.sources.size)
      throw new Error(`No data sources have been downloaded`);

    if (!dbSourceName || !this.sources.has(dbSourceName)) {

      // Hack: Denon will save metadata on streaming files but only on an
      // internal database. So if the source is "(Unknown)streaming://"
      // return the first internal database we find.
      for (const entry of Array.from(this.sources.entries())) {
        if (/\(Internal\)/.test(entry[0])) {
          Logger.debug(`Returning copy of internal database`);
          return this.sources.get(entry[0]);
        }
      }

      // Else, throw an exception.
      throw new Error(`Data source "${dbSourceName}" doesn't exist.`);
    }

    return this.sources.get(dbSourceName);
  }
  */

}
