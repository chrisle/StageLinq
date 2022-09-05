"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageLinq = void 0;
const network_1 = require("../network");
const events_1 = require("events");
const Player_1 = require("../devices/Player");
const utils_1 = require("../utils");
const services_1 = require("../services");
;
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
    constructor(options) {
        super();
        this.devices = new Map();
        this._maxRetries = 3;
        if (options && options.maxRetries)
            this._maxRetries = options.maxRetries;
    }
    /**
     * Connect to the StageLinq network.
     */
    async connect() {
        await (0, network_1.announce)();
        this._listener = new network_1.StageLinqListener();
        this._listener.onDeviceDiscovered(this.onDeviceDiscovered.bind(this));
    }
    /**
     * Disconnect from the StageLinq network.
     */
    async disconnect() {
        try {
            // Disconnect from all devices we've connected to.
            for (const device of this.devices.values()) {
                device.networkDevice.disconnect();
            }
            // Stop announcing.
            await (0, network_1.unannounce)();
        }
        catch (e) {
            throw new Error(e);
        }
    }
    /**
     * Attempt to connect to the player (retry if necessary).
     * @param device Device discovered
     * @returns
     */
    async onDeviceDiscovered(device) {
        let retry = 0;
        let error = '';
        const addressPort = `${device.address}:${device.port}`;
        // Retrying appears to be necessary because it seems the Denon hardware
        // refueses to connect. Retrying after a little bit of time seems to
        // solve the issue.
        while (retry < this._maxRetries) {
            retry += 1;
            try {
                console.log(`Connecting to ${device.software.name} on ${addressPort}`);
                const player = await this.connectToPlayer(device);
                console.log(`Successfully connected to ${addressPort}`);
                player.on('trackLoaded', (status) => {
                    this.emit('trackLoaded', status);
                });
                player.on('stateChanged', (status) => {
                    this.emit('stateChanged', status);
                });
                player.on('nowPlaying', (status) => {
                    this.emit('nowPlaying', status);
                });
                return;
            }
            catch (e) {
                (0, utils_1.sleep)(500);
                console.warn(`Could not connect to ${addressPort} (${retry}/${this._maxRetries}): ${e}`);
                error = e;
            }
        }
        throw new Error(`Failed to connect to ${addressPort}: ${error}`);
    }
    /**
     * Connect to the player. Throw exception it can't.
     * @param device Device to connect to.
     * @returns
     */
    async connectToPlayer(device) {
        const networkDevice = new network_1.NetworkDevice(device);
        await networkDevice.connect();
        const stateMap = await networkDevice.connectToService(services_1.StateMap);
        if (stateMap) {
            const player = new Player_1.Player({
                stateMap: stateMap,
                address: device.address,
                port: device.port
            });
            // Keep track of the devices we've connected so so we can disconnect from
            // them later.
            this.devices.set(device.address, {
                networkDevice: networkDevice,
            });
            return player;
        }
        ;
        throw new Error(`Could not connect to ${device.address}:${device.port}`);
    }
}
exports.StageLinq = StageLinq;
//# sourceMappingURL=index.js.map