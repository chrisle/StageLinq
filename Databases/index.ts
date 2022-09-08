import { EventEmitter } from 'stream';
import { FileTransfer } from '../services';
import { makeTempDownloadPath } from '../albumArt';
import { NetworkDevice } from '../network';
import * as fs from 'fs';
import Database = require('better-sqlite3');
import { Logger } from '../LogEmitter';

export declare interface Databases {
  on(event: 'dbDownloaded', listener: (sourceName: string, dbPath: string) => void): this;
  on(event: 'downloading', listener: (sourceName: string, dbPath: string) => void): this;
}

export class Databases extends EventEmitter {

  private networkDevice: NetworkDevice;
  sources: Map<string, Database.Database> = new Map();

  constructor(networkDevice: NetworkDevice) {
    super();
    this.networkDevice = networkDevice;
  }

  async downloadDb(options?: { addSource: boolean }) {
    const service = await this.networkDevice.connectToService(FileTransfer);
    const sources = await service.getSources();

    for (const source of sources) {
      const dbPath = makeTempDownloadPath(source.database.location);
      Logger.debug(`Downloading ${source.name} to ${dbPath}`);
      this.emit('downloading', source.name, dbPath);
      const file = await service.getFile(source.database.location);
      fs.writeFileSync(dbPath, file);
      if (options && options.addSource) this.addSource(source.name, dbPath);
      Logger.debug(`Downloaded ${source.name} to ${dbPath}`);
      this.emit('dbDownloaded', source.name, dbPath);
    }
  }

  private addSource(sourceName: string, dbPath: string) {
    const db = new Database(dbPath);
    this.sources.set(sourceName, db);
  }

  querySource<T>(sourceName: string, query: string, ...params: any[]): T[] {
    console.debug(query);
    if (!this.sources.has(sourceName))
      throw new Error(`Source ${sourceName} doesn't exist.`);
    const db = this.sources.get(sourceName);
    const result = db.prepare(query);
    return result.all(params);
  }

}
