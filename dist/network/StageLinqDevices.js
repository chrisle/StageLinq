"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageLinqDevices = void 0;
const events_1 = require("events");
const _1 = require(".");
const Player_1 = require("../devices/Player");
const utils_1 = require("../utils");
const services_1 = require("../services");
const LogEmitter_1 = require("../LogEmitter");
const db_1 = require("../db");
var ConnectionStatus;
(function (ConnectionStatus) {
    ConnectionStatus[ConnectionStatus["CONNECTING"] = 0] = "CONNECTING";
    ConnectionStatus[ConnectionStatus["CONNECTED"] = 1] = "CONNECTED";
    ConnectionStatus[ConnectionStatus["FAILED"] = 2] = "FAILED";
})(ConnectionStatus || (ConnectionStatus = {}));
;
;
const DEFAULT_MAX_RETRIES = 3;
//////////////////////////////////////////////////////////////////////////////
// TODO: Refactor device, listener, and player into something more nicer.
/**
 * Handle connecting and disconnecting from discovered devices on the
 * StageLinq network.
 */
class StageLinqDevices extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.devices = new Map();
        this.discoveryStatus = new Map();
        this.options = {
            maxRetries: DEFAULT_MAX_RETRIES,
            getMetdataFromFile: false,
            ...options
        };
    }
    /**
     * Attempt to connect to the player.
     *
     * @param connectionInfo Device discovered
     * @returns Retries to connect 3 times. If successful return void if not throw exception.
     */
    async handleDevice(connectionInfo) {
        LogEmitter_1.Logger.silly(this.showDiscoveryStatus(connectionInfo));
        // Ignore this discovery message if connected, connecting, failed, or
        // if it's blacklisted.
        if (this.isConnected(connectionInfo)
            || this.isConnecting(connectionInfo)
            || this.isFailed(connectionInfo)
            || this.isIgnored(connectionInfo))
            return;
        this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.CONNECTING);
        // Retrying appears to be necessary because it seems the Denon hardware
        // sometimes doesn't connect. Retrying after a little wait seems to
        // solve the issue.
        let attempt = 1;
        while (attempt < this.options.maxRetries) {
            try {
                LogEmitter_1.Logger.info(`Connecting to ${this.deviceId(connectionInfo)}. ` +
                    `Attempt ${attempt}/${this.options.maxRetries}`);
                // If this fails, catch it, and maybe retry if necessary.
                await this.connectToPlayer(connectionInfo);
                LogEmitter_1.Logger.info(`Successfully connected to ${this.deviceId(connectionInfo)}`);
                this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.CONNECTED);
                this.emit('connected', connectionInfo);
                return; // Don't forget to return!
            }
            catch (e) {
                // Failed connection. Sleep then retry.
                LogEmitter_1.Logger.warn(`Could not connect to ${this.deviceId(connectionInfo)} ` +
                    `(${attempt}/${this.options.maxRetries}): ${e}`);
                attempt += 1;
                (0, utils_1.sleep)(500);
            }
        }
        // We failed 3 times. Throw exception.
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
    ////////////////////////////////////////////////////////////////////////////
    /**
     * Connect to the player.
     * @param connectionInfo Device to connect to.
     * @returns
     */
    async connectToPlayer(connectionInfo) {
        const networkDevice = new _1.NetworkDevice(connectionInfo);
        await networkDevice.connect();
        // Track devices so we can disconnect from them later.
        this.devices.set(connectionInfo.address, { networkDevice: networkDevice });
        // Download the database before connecting to StateMap.
        const database = new db_1.Db(networkDevice);
        await database.downloadDb();
        // Setup StateMap
        const stateMap = await networkDevice.connectToService(services_1.StateMap);
        stateMap.on('message', (data) => {
            this.emit('message', connectionInfo, data);
        });
        // Setup Player
        const player = new Player_1.Player({
            stateMap: stateMap,
            address: connectionInfo.address,
            port: connectionInfo.port
        });
        player.on('trackLoaded', (status) => {
            this.emit('trackLoaded', status);
            // TODO: SELECT * FROM Tracks WHERE path = status.trackPath
        });
        player.on('stateChanged', (status) => {
            this.emit('stateChanged', status);
        });
        player.on('nowPlaying', (status) => {
            this.emit('nowPlaying', status);
        });
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
            || device.source === 'nowplaying' // Ignore myself
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