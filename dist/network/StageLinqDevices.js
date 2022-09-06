"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageLinqDevices = void 0;
const events_1 = require("events");
const _1 = require(".");
const Player_1 = require("../devices/Player");
const utils_1 = require("../utils");
const services_1 = require("../services");
const LogEmitter_1 = require("../LogEmitter");
var ConnectionStatus;
(function (ConnectionStatus) {
    ConnectionStatus[ConnectionStatus["CONNECTING"] = 0] = "CONNECTING";
    ConnectionStatus[ConnectionStatus["CONNECTED"] = 1] = "CONNECTED";
    ConnectionStatus[ConnectionStatus["FAILED"] = 2] = "FAILED";
})(ConnectionStatus || (ConnectionStatus = {}));
;
;
//////////////////////////////////////////////////////////////////////////////
/**
 * Handle connecting and disconnecting from discovered devices on the
 * StageLinq network.
 */
class StageLinqDevices extends events_1.EventEmitter {
    constructor(retries = 3) {
        super();
        this.discoveryStatus = new Map();
        this.devices = new Map();
        this.maxRetries = retries;
    }
    /**
     * Attempt to connect to the player (retry if necessary).
     * @param connectionInfo Device discovered
     * @returns
     */
    async handleDevice(connectionInfo) {
        LogEmitter_1.Logger.silly(this.showDiscoveryStatus(connectionInfo));
        if (this.isConnected(connectionInfo)
            || this.isConnecting(connectionInfo)
            || this.isIgnored(connectionInfo))
            return;
        this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.CONNECTING);
        // Retrying appears to be necessary because it seems the Denon hardware
        // sometimes doesn't connect. Retrying after a little wait seems to
        // solve the issue.
        let attempt = 1;
        while (attempt < this.maxRetries) {
            try {
                LogEmitter_1.Logger.info(`Connecting to ${this.deviceId(connectionInfo)}. Attempt ${attempt}/${this.maxRetries}`);
                // This will fail if it doesn't connect.
                const player = await this.connectToPlayer(connectionInfo);
                LogEmitter_1.Logger.info(`Successfully connected to ${this.deviceId(connectionInfo)}`);
                this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.CONNECTED);
                this.emit('connected', connectionInfo);
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
                LogEmitter_1.Logger.warn(`Could not connect to ${this.deviceId(connectionInfo)} ` +
                    `(${attempt}/${this.maxRetries}): ${e}`);
                attempt += 1;
                (0, utils_1.sleep)(500);
            }
        }
        this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.FAILED);
        throw new Error(`Could not connect to ${this.deviceId(connectionInfo)}`);
    }
    /**
     * Disconnect from all connected devices
     */
    disconnectAll() {
        for (const device of this.devices.values()) {
            device.networkDevice.disconnect();
        }
    }
    /**
     * Connect to the player. Throw exception it can't.
     * @param device Device to connect to.
     * @returns
     */
    async connectToPlayer(device) {
        const networkDevice = new _1.NetworkDevice(device);
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
            stateMap.on('message', (data) => { this.emit('message', device, data); });
            return player;
        }
        ;
        throw new Error(`Could not connect to ${device.address}:${device.port}`);
    }
    deviceId(device) {
        return `${device.address}:${device.port}:` +
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
        let msg = `Discovery: ${this.deviceId(device)} `;
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
//# sourceMappingURL=StageLinqDevices.js.map