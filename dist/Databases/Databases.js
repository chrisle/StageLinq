"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Databases = void 0;
const stream_1 = require("stream");
const services_1 = require("../services");
const utils_1 = require("../utils");
const LogEmitter_1 = require("../LogEmitter");
const fs = require("fs");
class Databases extends stream_1.EventEmitter {
    constructor() {
        super();
        this.sources = new Map();
    }
    async downloadSourcesFromDevice(connectionInfo, networkDevice) {
        const service = await networkDevice.connectToService(services_1.FileTransfer);
        const sources = await service.getSources();
        const output = [];
        for (const source of sources) {
            const deviceId = /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
                .exec(Buffer.from(connectionInfo.token).toString('hex')).splice(1).join('-');
            const dbConnectionName = `net://${deviceId}/${source.name}`;
            LogEmitter_1.Logger.debug(`DB network path: ${dbConnectionName}`);
            if (this.sources.has(dbConnectionName)) {
                LogEmitter_1.Logger.debug(`Already seen ${source} on ${connectionInfo.address}:${connectionInfo.port}`);
            }
            else {
                await this.downloadDb(dbConnectionName, service, source);
                output.push(dbConnectionName);
            }
        }
        return output;
    }
    /**
     * Download databases from this network source.
     */
    async downloadDb(sourceId, service, source) {
        const dbPath = (0, utils_1.getTempFilePath)(`${sourceId}/m.db`);
        // Read database from source
        LogEmitter_1.Logger.debug(`Reading database ${sourceId}`);
        this.emit('dbDownloading', sourceId, dbPath);
        service.on('fileTransferProgress', (progress) => {
            this.emit('dbProgress', sourceId, progress.total, progress.bytesDownloaded, progress.percentComplete);
        });
        // Save database to a file
        const file = await service.getFile(source.database.location);
        LogEmitter_1.Logger.debug(`Saving ${sourceId} to ${dbPath}`);
        fs.writeFileSync(dbPath, Buffer.from(file));
        this.sources.set(sourceId, dbPath);
        LogEmitter_1.Logger.debug(`Downloaded ${sourceId} to ${dbPath}`);
        this.emit('dbDownloaded', sourceId, dbPath);
    }
    getDbPath(dbSourceName) {
        if (!this.sources.size)
            throw new Error(`No data sources have been downloaded`);
        if (!dbSourceName || !this.sources.has(dbSourceName)) {
            // Hack: Denon will save metadata on streaming files but only on an
            // internal database. So if the source is "(Unknown)streaming://"
            // return the first internal database we find.
            for (const entry of Array.from(this.sources.entries())) {
                if (/\(Internal\)/.test(entry[0])) {
                    LogEmitter_1.Logger.debug(`Returning copy of internal database`);
                    return this.sources.get(entry[0]);
                }
            }
            // Else, throw an exception.
            throw new Error(`Data source "${dbSourceName}" doesn't exist.`);
        }
        return this.sources.get(dbSourceName);
    }
}
exports.Databases = Databases;
//# sourceMappingURL=Databases.js.map