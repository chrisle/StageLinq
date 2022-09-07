import { FileTransfer } from '../services';
import { Logger } from '../LogEmitter';
import { makeTempDownloadPath } from '../albumArt';
import { NetworkDevice } from '../network';
import * as fs from 'fs';

export class Db {

  private networkDevice: NetworkDevice;

  constructor(networkDevice: NetworkDevice) {
    this.networkDevice = networkDevice;
  }

  async downloadDb() {
    const service = await this.networkDevice.connectToService(FileTransfer);
    const sources = await service.getSources();

    for (const source of sources) {
      const dbPath = makeTempDownloadPath(source.database.location);
      Logger.debug(`Downloading ${source.database.location} to ${dbPath} ...`)
      const file = await service.getFile(source.database.location);
      fs.writeFileSync(dbPath, file);
      Logger.info(`Downloaded ${source.database.location} to ${dbPath} complete.`);
    }
    service.disconnect();
  }


}