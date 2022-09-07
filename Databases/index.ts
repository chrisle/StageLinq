import { EventEmitter } from 'stream';
import { FileTransfer } from '../services';
import { makeTempDownloadPath } from '../albumArt';
import { NetworkDevice } from '../network';
import * as fs from 'fs';
import Database = require('better-sqlite3');

export declare interface Databases {
  on(event: 'dbDownloaded', listener: (sourceName: string, dbPath: string) => void): this;
  on(event: 'downloading', listener: (sourceName: string, dbPath: string) => void): this;
}
export class Databases extends EventEmitter {

  private networkDevice: NetworkDevice;
  private sources: Map<string, Database.Database> = new Map();

  constructor(networkDevice: NetworkDevice) {
    super();
    this.networkDevice = networkDevice;
  }

  async downloadDb() {
    const service = await this.networkDevice.connectToService(FileTransfer);
    const sources = await service.getSources();

    for (const source of sources) {
      const dbPath = makeTempDownloadPath(source.database.location);
      this.emit('downloading', source.name, dbPath);
      const file = await service.getFile(source.database.location);
      fs.writeFileSync(dbPath, file);
      const db = new Database(dbPath);
      this.sources.set(source.name, db);
      this.emit('dbDownloaded', source.name, dbPath);
    }
    service.disconnect();
  }

  querySource(sourceName: string, query: string, ...params: any[]): any[] {
    console.debug(query);
    if (!this.sources.has(sourceName))
      throw new Error(`Source ${sourceName} doesn't exist.`);
    const db = this.sources.get(sourceName);
    const result = db.prepare(query);
    return result.all(params);
  }

}
