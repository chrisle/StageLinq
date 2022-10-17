import {  Source } from '../types';
import { EventEmitter } from 'stream';
import { getTempFilePath } from '../utils';
import { Logger } from '../LogEmitter';
import * as fs from 'fs';
import { StageLinq } from '../StageLinq';
import * as Services from '../services';



export declare interface Databases {
  on(event: 'dbDownloaded', listener: (sourceName: string, dbPath: string) => void): this;
  on(event: 'dbDownloading', listener: (sourceName: string, dbPath: string) => void): this;
  on(event: 'dbProgress', listener: (sourceName: string, total: number, bytesDownloaded: number, percentComplete: number) => void): this;
}

export class Databases extends EventEmitter {
  parent: InstanceType<typeof StageLinq>;
  sources: Map<string, Source> = new Map();

  constructor(_parent: InstanceType<typeof StageLinq>) {
    super();
    this.parent = _parent;
  }

  /*
  async downloadSourcesFromDevice(connectionInfo: ConnectionInfo, networkDevice: NetworkDevice) {
    const service = await networkDevice.connectToService(FileTransfer);
    const sources = await service.getSources();
    const output: string[] = [];
    for (const source of sources) {
      const deviceId = /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
        .exec(Buffer.from(connectionInfo.token).toString('hex')).splice(1).join('-');
      const dbConnectionName = `net://${deviceId}/${source.name}`;
      Logger.debug(`DB network path: ${dbConnectionName}`);
      if (this.sources.has(dbConnectionName)) {
        Logger.debug(`Already seen ${source} on ${connectionInfo.address}:${connectionInfo.port}`);
      } else {
        await this.downloadDb(dbConnectionName, service, source);
        output.push(dbConnectionName);
      }
    }
    return output;
  }
  */

  /**
   * Download databases from this network source.
   */
  
   async downloadDb(deviceId: string) {
    
    Logger.debug(`downloadDb request for ${deviceId}`);
    
    const service = this.parent.services[deviceId].get('FileTransfer') as Services.FileTransfer ;
    const socket = this.parent.sockets[deviceId].get('FileTransfer');
    
    for (const [sourceName, source] of service.sources) {
      const dbPath = getTempFilePath(`${deviceId}/${sourceName}/m.db`);

      Logger.info(`Reading database ${deviceId}/${source.name}`);
      this.emit('dbDownloading', deviceId, dbPath);

      service.on('fileTransferProgress', (progress) => {
        this.emit('dbProgress', deviceId, progress.total, progress.bytesDownloaded, progress.percentComplete);
        Logger.debug('dbProgress', deviceId, progress.total, progress.bytesDownloaded, progress.percentComplete);
      });

    source.database.local = {
      path: dbPath,
    };
    
      // Save database to a file
    const file = await service.getFile(source.database.location, socket);
    Logger.info(`Saving ${deviceId}/${sourceName} to ${dbPath}`);
    fs.writeFileSync(dbPath, Buffer.from(file));

    Logger.info(`Downloaded ${deviceId}/${sourceName} to ${dbPath}`);
    this.emit('dbDownloaded', deviceId, dbPath);
    this.sources.set(sourceName, source)
    Logger.info(sourceName, source);
  }
}

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

}
