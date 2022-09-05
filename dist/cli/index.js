"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sleep_1 = require("../utils/sleep");
const StageLinq_1 = require("../StageLinq");
require('console-stamp')(console, {
    format: ':date(HH:MM:ss) :label',
});
(async () => {
    console.log('Starting CLI');
    const stageLinq = new StageLinq_1.StageLinq();
    stageLinq.on('trackLoaded', (status) => {
        console.log('New track loaded:', status);
    });
    stageLinq.on('nowPlaying', (status) => {
        console.log(`Now Playing on [${status.deck}]: ${status.title} - ${status.artist}`);
    });
    // stageLinq.on('player', (status) => {
    //   console.log('Player status change', status);
    // });
    let returnCode = 0;
    try {
        process.on('SIGINT', async function () {
            console.info('... exiting');
            // Ensure SIGINT won't be impeded by some error
            try {
                await stageLinq.disconnect();
            }
            catch (err) {
                const message = err.stack.toString();
                console.error(message);
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
        console.error(message);
        returnCode = 1;
    }
    await stageLinq.disconnect();
    process.exit(returnCode);
})();
//# sourceMappingURL=index.js.map