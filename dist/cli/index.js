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
    stageLinq.logger.on('error', (...args) => {
        console.error(...args);
    });
    stageLinq.logger.on('warn', (...args) => {
        console.warn(...args);
    });
    stageLinq.logger.on('info', (...args) => {
        console.info(...args);
    });
    stageLinq.logger.on('log', (...args) => {
        console.log(...args);
    });
    stageLinq.logger.on('debug', (...args) => {
        console.debug(...args);
    });
    // stageLinq.logger.on('silly', (...args: any) => {
    //   console.debug(...args)
    // });
    stageLinq.devices.on('trackLoaded', (status) => {
        console.log('New track loaded:', status);
    });
    stageLinq.devices.on('nowPlaying', (status) => {
        console.log(`Now Playing on [${status.deck}]: ${status.title} - ${status.artist}`);
    });
    // stageLinq.devices.on('stateChanged', (status) => {
    //   console.log(`State changed on [${status.deck}]`, status)
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