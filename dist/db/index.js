"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Db = void 0;
const services_1 = require("../services");
const LogEmitter_1 = require("../LogEmitter");
const albumArt_1 = require("../albumArt");
const fs = require("fs");
class Db {
    constructor(networkDevice) {
        this.networkDevice = networkDevice;
    }
    async downloadDb() {
        const service = await this.networkDevice.connectToService(services_1.FileTransfer);
        const sources = await service.getSources();
        for (const source of sources) {
            const dbPath = (0, albumArt_1.makeTempDownloadPath)(source.database.location);
            const file = await service.getFile(source.database.location);
            fs.writeFileSync(dbPath, file);
            LogEmitter_1.Logger.info(`Downloaded ${source.database.location} to ${dbPath}`);
        }
        service.disconnect();
    }
}
exports.Db = Db;
//# sourceMappingURL=index.js.map