"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageLinq = void 0;
const network_1 = require("../network");
const events_1 = require("events");
const StageLinqDevices_1 = require("../network/StageLinqDevices");
const LogEmitter_1 = require("../LogEmitter");
const types_1 = require("../types");
const DEFAULT_OPTIONS = {
    maxRetries: 3,
    actingAs: types_1.ActingAsDevice.NowPlaying,
    downloadDbSources: true
};
/**
 * Main StageLinq class.
 */
class StageLinq extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.logger = LogEmitter_1.Logger.instance;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.devices = new StageLinqDevices_1.StageLinqDevices(this.options);
    }
    /**
     * Connect to the StageLinq network.
     */
    async connect() {
        this.listener = new network_1.StageLinqListener();
        const msg = (0, network_1.createDiscoveryMessage)(types_1.Action.Login, this.options.actingAs);
        await (0, network_1.announce)(msg);
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
            const msg = (0, network_1.createDiscoveryMessage)(types_1.Action.Logout, this.options.actingAs);
            await (0, network_1.unannounce)(msg);
        }
        catch (e) {
            throw new Error(e);
        }
    }
    get databases() {
        return this.devices.databases;
    }
}
exports.StageLinq = StageLinq;
//# sourceMappingURL=index.js.map