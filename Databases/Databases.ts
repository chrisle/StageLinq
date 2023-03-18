import { EventEmitter } from 'stream';
import { getTempFilePath } from '../utils';
import { Logger } from '../LogEmitter';
import * as fs from 'fs';
import { StageLinq } from '../StageLinq';
import { DbConnection } from './DbConnection';
import { Source } from '../types';


export declare interface Databases {
  on(event: 'dbNewSource', listener: ( source: Source) => void): this;
  on(event: 'dbDownloaded', listener: (sourceName: string, dbPath: string) => void): this;
  on(event: 'dbDownloading', listener: (sourceName: string, dbPath: string) => void): this;
  on(event: 'dbProgress', listener: (sourceName: string, total: number, bytesDownloaded: number, percentComplete: number) => void): this;
}

export class Databases extends EventEmitter {
  parent: InstanceType<typeof StageLinq>;

  constructor(_parent: InstanceType<typeof StageLinq>) {
    super();
    this.parent = _parent;
  }

  /**
   * Download databases from this network source.
   */
  
   async downloadDb(sourceName: string) {
    
    Logger.debug(`downloadDb request for ${sourceName}`);
    
    const source = this.parent.getSource(sourceName);

    let thisTxid: number = 0

    const dbPath = getTempFilePath(`${source.deviceId.toString()}/${source.name}/m.db`);

    Logger.info(`Reading database ${source.deviceId.toString()}/${source.name}`);
    this.emit('dbDownloading', source.name, dbPath);

    source.service.on('fileTransferProgress', (txid, progress) => {
      if (thisTxid === txid) {
        this.emit('dbProgress', source.name, progress.total, progress.bytesDownloaded, progress.percentComplete);
        //Logger.debug('dbProgress', deviceId, progress.total, progress.bytesDownloaded, progress.percentComplete);
      } else {
        //console.warn(txid, thisTxid)
      }
    });

  source.database.local = {
    path: dbPath,
  };
  source.database.connection = new DbConnection(dbPath)
  
    // Save database to a file
  thisTxid = source.service.txid;
  const file = await source.service.getFile(source.database.location, source.service.socket);
  Logger.info(`Saving ${source.deviceId.toString()}/${sourceName} to ${dbPath}`);
  fs.writeFileSync(dbPath, Buffer.from(file));

  this.parent.setSource(source);
  Logger.info(`Downloaded ${source.deviceId.toString()}/${sourceName} to ${dbPath}`);
  this.emit('dbDownloaded', source.deviceId.toString(), dbPath);
  this.emit('dbNewSource', source)
}

  getDbPath(dbSourceName?: string) {
    const source = this.parent.getSource(dbSourceName);
    
    if (!source.database.size)
      throw new Error(`No data sources have been downloaded`);

    if (!dbSourceName || !this.parent.hasSource(dbSourceName)) {

      // Hack: Denon will save metadata on streaming files but only on an
      // internal database. So if the source is "(Unknown)streaming://"
      // return the first internal database we find.
      for (const entry of this.parent.getSourcesArray()) { //Array.from(this.sources.entries())) {
        if (/\(Internal\)/.test(entry[0])) {
          Logger.debug(`Returning copy of internal database`);
          return this.parent.getSource(entry[0]);
        }
      }
      // Else, throw an exception.
      throw new Error(`Data source "${dbSourceName}" doesn't exist.`);
    }

    return this.parent.getSource(dbSourceName);
  }
}
