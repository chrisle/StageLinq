import { ConnectionInfo, Source } from '../types';
import { EventEmitter } from 'stream';
import { FileTransfer } from '../services';
import { getTempFilePath } from '../utils';
import { Logger } from '../LogEmitter';
import { NetworkDevice } from '../network';
import * as fs from 'fs';

export declare interface Databases {
  on(event: 'dbDownloaded', listener: (sourceName: string, dbPath: string) => void): this;
  on(event: 'dbDownloading', listener: (sourceName: string, dbPath: string) => void): this;
  on(event: 'dbProgress', listener: (sourceName: string, total: number, bytesDownloaded: number, percentComplete: number) => void): this;
}

export class Databases extends EventEmitter {

  sources: Map<string, string> = new Map();

  constructor() {
    super();
  }

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

  /**
   * Download databases from this network source.
   */
  async downloadDb(sourceId: string, service: FileTransfer, source: Source) {
    const dbPath = getTempFilePath(`${sourceId}/m.db`);

    // Read database from source
    Logger.debug(`Reading database ${sourceId}`);
    this.emit('dbDownloading', sourceId, dbPath);

    service.on('fileTransferProgress', (progress) => {
      this.emit('dbProgress', sourceId, progress.total, progress.bytesDownloaded, progress.percentComplete);
    });

    // Save database to a file
    const file = await service.getFile(source.database.location);
    Logger.debug(`Saving ${sourceId} to ${dbPath}`);
    fs.writeFileSync(dbPath, Buffer.from(file));
    this.sources.set(sourceId, dbPath);

    Logger.debug(`Downloaded ${sourceId} to ${dbPath}`);
    this.emit('dbDownloaded', sourceId, dbPath);
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
