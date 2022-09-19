import { EventEmitter } from 'stream';
import { FileTransfer } from '../services';
import { getTempFilePath } from '../albumArt';
import { NetworkDevice } from '../network';
import * as fs from 'fs';
import { Logger } from '../LogEmitter';
import { ConnectionInfo, Source } from '../types';

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
      const dbConnectionName = `${connectionInfo.address}_${connectionInfo.port}_${source.name}`;
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

  getDbPath(dbSourceName: string) {
    if (!this.sources.has(dbSourceName))
      throw new Error(`Database name ${dbSourceName} does not exist`);
    return this.sources.get(dbSourceName);
  }

}
