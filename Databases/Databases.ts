import { EventEmitter } from 'stream';
import { getTempFilePath } from '../utils';
import { Logger } from '../LogEmitter';
import * as fs from 'fs';
import { StageLinq } from '../StageLinq';
import { DbConnection } from './DbConnection';
import { Source } from '../types';
import { FileTransferProgress } from '../services';


export declare interface Databases {
  //on(event: 'dbNewSource', listener: ( source: Source) => void): this;
  on(event: 'dbDownloaded', listener: (source: Source) => void): this;
  on(event: 'dbDownloading', listener: (sourceName: string, dbPath: string) => void): this;
  on(event: 'dbProgress', listener: (sourceName: string, txid: number,  progress: FileTransferProgress) => void): this;
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
  
  async downloadDb(source: Source) {
    
    Logger.debug(`downloadDb request for ${source.name}`);
    
    //const source = this.parent.getSource(sourceName);

    //let thisTxid: number = 0

    const dbPath = getTempFilePath(`${source.deviceId.string}/${source.name}/m.db`);

    Logger.info(`Reading database ${source.deviceId.string}/${source.name}`);
    //this.emit('dbDownloading', source.name, dbPath);

   
    source.database.local = {
      path: dbPath,
    };
    source.database.connection = new DbConnection(dbPath)

      // Save database to a file
    //thisTxid = source.service.txid;
    const file = await source.service.getFile(source.database.location, source.service.socket);
    Logger.info(`Saving ${source.deviceId.string}/${source.name} to ${dbPath}`);
    fs.writeFileSync(dbPath, Buffer.from(file));

    source.database.connection = new DbConnection(dbPath);

    this.parent.setSource(source);
    Logger.info(`Downloaded ${source.deviceId.string}/${source.name} to ${dbPath}`);
    this.emit('dbDownloaded', source);
    
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
