"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageLinqDevices = void 0;
const network_1 = require("../network");
const events_1 = require("events");
const Player_1 = require("../devices/Player");
const utils_1 = require("../utils");
const services_1 = require("../services");
var ConnectionStatus;
(function (ConnectionStatus) {
    ConnectionStatus[ConnectionStatus["CONNECTING"] = 0] = "CONNECTING";
    ConnectionStatus[ConnectionStatus["CONNECTED"] = 1] = "CONNECTED";
    ConnectionStatus[ConnectionStatus["FAILED"] = 2] = "FAILED";
})(ConnectionStatus || (ConnectionStatus = {}));
;
;
class StageLinqDevices extends events_1.EventEmitter {
    constructor(retries = 3) {
        super();
        this.discoveryStatus = new Map();
        this.devices = new Map();
        this.maxRetries = retries;
    }
    /**
     * Attempt to connect to the player (retry if necessary).
     * @param device Device discovered
     * @returns
     */
    async onDeviceDiscovered(device) {
        console.log(this.showDiscoveryStatus(device));
        if (this.isConnected(device) || this.isConnecting(device)
            || this.isIgnored(device))
            return;
        this.discoveryStatus.set(this.deviceId(device), ConnectionStatus.CONNECTING);
        // Retrying appears to be necessary because it seems the Denon hardware
        // refueses to connect. Retrying after a little bit of time seems to
        // solve the issue.
        let attempt = 1;
        while (attempt < this.maxRetries) {
            try {
                console.log(`Connecting to ${this.deviceId(device)}`);
                // This will fail if it doesn't connect.
                const player = await this.connectToPlayer(device);
                console.log(`Successfully connected to ${this.deviceId(device)}`);
                this.discoveryStatus.set(this.deviceId(device), ConnectionStatus.CONNECTED);
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
                console.warn(`Could not connect to ${this.deviceId(device)} ` +
                    `(${attempt}/${this.maxRetries}): ${e}`);
                attempt += 1;
                (0, utils_1.sleep)(500);
            }
        }
        this.discoveryStatus.set(this.deviceId(device), ConnectionStatus.FAILED);
        throw new Error(`Could not connect to ${this.deviceId(device)}`);
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
    deviceId(device) {
        return `${device.address}:${device.port}` +
            `[${device.source}/${device.software.name}]`;
    }
    isConnecting(device) {
        return this.discoveryStatus.get(this.deviceId(device))
            === ConnectionStatus.CONNECTING;
    }
    isConnected(device) {
        return this.discoveryStatus.get(this.deviceId(device))
            === ConnectionStatus.CONNECTED;
    }
    isFailed(device) {
        return this.discoveryStatus.get(this.deviceId(device))
            === ConnectionStatus.FAILED;
    }
    isIgnored(device) {
        return (device.software.name === 'OfflineAnalyzer'
            || device.source === 'nowplaying'
            || /^SoundSwitch/i.test(device.software.name)
            || /^Resolume/i.test(device.software.name)
            || device.software.name === 'JM08' // Ignore X1800/X1850 mixers
        );
    }
    isDeviceSeen(device) {
        return this.discoveryStatus.has(device.address);
    }
    showDiscoveryStatus(device) {
        let msg = `>>> ${this.deviceId(device)} `;
        if (!this.isDeviceSeen)
            return msg += '(NEW)';
        if (this.isIgnored(device))
            return msg += '(IGNORED)';
        return msg += (this.isConnecting(device) ? '(CONNECTING)'
            : this.isConnected(device) ? '(CONNECTED)'
                : this.isFailed(device) ? '(FAILED)'
                    : '(NEW)');
    }
}
exports.StageLinqDevices = StageLinqDevices;
//# sourceMappingURL=StageLinqDiscovery.js.map