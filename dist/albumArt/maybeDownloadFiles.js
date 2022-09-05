"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maybeDownloadFiles = void 0;
const services_1 = require("../services");
const makeDownloadPath_1 = require("./makeDownloadPath");
const assert_1 = require("assert");
const fs = require("fs");
const minimist = require("minimist");
async function maybeDownloadFiles(controller) {
    const args = minimist(process.argv.slice(2));
    if (!args.disableFileTransfer) {
        const ftx = await controller.connectToService(services_1.FileTransfer);
        (0, assert_1.strict)(ftx);
        const sources = await ftx.getSources();
        {
            const sync = !args.skipsync;
            for (const source of sources) {
                const dbPath = (0, makeDownloadPath_1.makeDownloadPath)(source.database.location);
                // FIXME: Move all this away from main
                if (sync) {
                    const file = await ftx.getFile(source.database.location);
                    fs.writeFileSync(dbPath, file);
                    console.info(`downloaded: '${source.database.location}' and stored in '${dbPath}'`);
                }
                await controller.addSource(source.name, dbPath, (0, makeDownloadPath_1.makeDownloadPath)(`${source.name}/Album Art/`));
                if (sync) {
                    await controller.dumpAlbumArt(source.name);
                }
            }
            ftx.disconnect();
        }
    }
}
exports.maybeDownloadFiles = maybeDownloadFiles;
//# sourceMappingURL=maybeDownloadFiles.js.map