"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sleep_1 = require("../utils/sleep");
const StageLinq_1 = require("../StageLinq");
const Logger_1 = require("../utils/Logger");
(async () => {
    Logger_1.Logger.log('Starting CLI');
    const stageLinq = new StageLinq_1.StageLinq();
    stageLinq.on('trackLoaded', (status) => {
        Logger_1.Logger.log('New track loaded:', status);
    });
    stageLinq.on('nowPlaying', (status) => {
        Logger_1.Logger.log(`Now Playing on [${status.deck}]: ${status.title} - ${status.artist}`);
    });
    stageLinq.on('connected', () => {
        Logger_1.Logger.log(`******** CONNECTED TO MORE THAN TWO **********`);
        ;
    });
    // stageLinq.on('player', (status) => {
    //   Logger.log('Player status change', status);
    // });
    let returnCode = 0;
    try {
        process.on('SIGINT', async function () {
            Logger_1.Logger.info('... exiting');
            // Ensure SIGINT won't be impeded by some error
            try {
                await stageLinq.disconnect();
            }
            catch (err) {
                const message = err.stack.toString();
                Logger_1.Logger.error(message);
            }
            process.exit(returnCode);
        });
        await stageLinq.connect();
        while (true) {
            await (0, sleep_1.sleep)(250);
        }
    }
    catch (err) {
        const message = err.stack.toString();
        Logger_1.Logger.error(message);
        returnCode = 1;
    }
    await stageLinq.disconnect();
    process.exit(returnCode);
})();
//# sourceMappingURL=index.js.map