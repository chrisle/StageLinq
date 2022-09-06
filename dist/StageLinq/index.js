"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageLinq = void 0;
const network_1 = require("../network");
const events_1 = require("events");
const StageLinqDevices_1 = require("../network/StageLinqDevices");
const LogEmitter_1 = require("../LogEmitter");
/**
 * Main StageLinq class.
 */
class StageLinq extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.devices = new StageLinqDevices_1.StageLinqDevices();
        this.logger = LogEmitter_1.Logger.instance;
        this.listener = new network_1.StageLinqListener();
    }
    /**
     * Connect to the StageLinq network.
     */
    async connect() {
        await (0, network_1.announce)();
        this.listener.listenForDevices(async (connectionInfo) => {
            await this.devices.handleDevice(connectionInfo);
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