"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageLinq = void 0;
const network_1 = require("../network");
const events_1 = require("events");
const StageLinqDevices_1 = require("../network/StageLinqDevices");
const Logger_1 = require("../utils/Logger");
/**
 * Main StageLinq class.
 *
 * Example:
 *
 * import { StageLinq } from 'StageLinq';
 * const stageLinq = new StageLinq();
 * stageLinq.on('trackLoaded', (status) => { console.log(status); });
 * stageLinq.on('stateChanged', (status) => { console.log(status); });
 * stageLinq.on('stateChanged', (status) => {
 *   console.log(`Playing on [${status.deck}]: ${status.title} - ${status.artist}`);
 * });
 */
class StageLinq extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.listener = new network_1.StageLinqListener();
        this.devices = new StageLinqDevices_1.StageLinqDevices();
    }
    /**
     * Connect to the StageLinq network.
     */
    async connect() {
        await (0, network_1.announce)();
        this.listener.listenForDevices(async (connectionInfo) => {
            await this.devices.handleDevice(connectionInfo);
        });
        this.devices.on('trackLoaded', (state) => {
            Logger_1.Logger.log(`New track loaded on ${state.deck}: ${JSON.stringify(state)}`);
        });
    }
    /**
     * Disconnect from the StageLinq network.
     */
    async disconnect() {
        try {
            this.devices.disconnectAll();
            await (0, network_1.unannounce)();
        }
        catch (e) {
            throw new Error(e);
        }
    }
}
exports.StageLinq = StageLinq;
//# sourceMappingURL=index.js.map