"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageLinqDevices = void 0;
const events_1 = require("events");
const _1 = require(".");
const Player_1 = require("../devices/Player");
const utils_1 = require("../utils");
const services_1 = require("../services");
const LogEmitter_1 = require("../LogEmitter");
const Databases_1 = require("../Databases");
var ConnectionStatus;
(function (ConnectionStatus) {
    ConnectionStatus[ConnectionStatus["CONNECTING"] = 0] = "CONNECTING";
    ConnectionStatus[ConnectionStatus["CONNECTED"] = 1] = "CONNECTED";
    ConnectionStatus[ConnectionStatus["FAILED"] = 2] = "FAILED";
})(ConnectionStatus || (ConnectionStatus = {}));
;
;
// This time needs to be just long enough for discovery messages from all to
// come through.
const WAIT_FOR_DEVICES_TIMEOUT_MS = 3000;
//////////////////////////////////////////////////////////////////////////////
/**
 * Handle connecting and disconnecting from discovered devices on the
 * StageLinq network.
 */
class StageLinqDevices extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.devices = new Map();
        this.discoveryStatus = new Map();
        this.deviceWatchTimeout = null;
        this.stateMapCallback = [];
        this.options = options;
        this._databases = new Databases_1.Databases();
        this.waitForAllDevices = this.waitForAllDevices.bind(this);
        this.waitForAllDevices();
    }
    /**
     * Handle incoming discovery messages from the StageLinq network
     *
     * @param connectionInfo Connection info.
     */
    async handleDevice(connectionInfo) {
        LogEmitter_1.Logger.silly(this.showDiscoveryStatus(connectionInfo));
        // Ignore this discovery message if we've already connected to it,
        // are still connecting, if it has failed, or if it's blacklisted.
        if (this.isConnected(connectionInfo)
            || this.isConnecting(connectionInfo)
            || this.isFailed(connectionInfo)
            || this.isIgnored(connectionInfo))
            return;
        this.connectToDevice(connectionInfo);
    }
    /**
     * Disconnect from all connected devices
     */
    disconnectAll() {
        for (const device of this.devices.values()) {
            device.networkDevice.disconnect();
        }
    }
    get databases() {
        return this._databases;
    }
    async downloadFile(deviceId, path) {
        if (this.options.enableFileTranfer) {
            const device = this.devices.get(deviceId);
            // Wait until FileTransfer.getFile is free
            await device.fileTransferService.waitTillAvailable();
            const file = await device.fileTransferService.getFile(path);
            return file;
        }
        else {
            const err = `File transfer service is not enabled. Cannot download ${path}`;
            LogEmitter_1.Logger.error(err);
            throw new Error(err);
        }
    }
    ////////////////////////////////////////////////////////////////////////////
    /**
     * Waits for all devices to be connected with databases downloaded
     * then connects to the StateMap.
     *
     * Explained:
     *
     * Why wait for all devices? Because a race condition exists when using the
     * database methods.
     *
     * If there are two SC6000 players on the network both will be sending
     * broadcast packets and so their StateMap can be initialized at any time
     * in any order.
     *
     * Assume you have player 1 and player 2 linked. Player 2 has a track that
     * is loaded from a USB drive plugged into player 1. Player 2 will be
     * ready before Player 1 because Player 1 will still be downloading a large
     * database. The race condition is if you try to read from the database on
     * the track that is plugged into Player 1 that isn't ready yet.
     *
     * This method prevents that by waiting for both players to connect and
     * have their databases loaded before initializing the StateMap.
     *
     */
    waitForAllDevices() {
        LogEmitter_1.Logger.log('Start watching for devices ...');
        this.deviceWatchTimeout = setInterval(async () => {
            // Check if any devices are still connecting.
            const values = Array.from(this.discoveryStatus.values());
            const foundDevices = values.length >= 1;
            const allConnected = !values.includes(ConnectionStatus.CONNECTING);
            const entries = Array.from(this.discoveryStatus.entries());
            LogEmitter_1.Logger.debug(`Waiting devices: ${JSON.stringify(entries)}`);
            if (foundDevices && allConnected) {
                LogEmitter_1.Logger.log('All devices found!');
                LogEmitter_1.Logger.debug(`Devices found: ${values.length} ${JSON.stringify(entries)}`);
                clearInterval(this.deviceWatchTimeout);
                for (const cb of this.stateMapCallback) {
                    this.setupStateMap(cb.connectionInfo, cb.networkDevice);
                }
                this.emit('ready');
            }
            else {
                LogEmitter_1.Logger.log(`Waiting for devices ...`);
            }
        }, WAIT_FOR_DEVICES_TIMEOUT_MS);
    }
    /**
     * Attempt to connect to a device. Retry if necessary.
     *
     * @param connectionInfo Connection info
     * @returns
     */
    async connectToDevice(connectionInfo) {
        // Mark this device as connecting.
        this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.CONNECTING);
        let attempt = 1;
        while (attempt < this.options.maxRetries) {
            try {
                // Connect to the device.
                LogEmitter_1.Logger.info(`Connecting to ${this.deviceId(connectionInfo)}. ` +
                    `Attempt ${attempt}/${this.options.maxRetries}`);
                const networkDevice = new _1.NetworkDevice(connectionInfo);
                await networkDevice.connect();
                // Setup file transfer service
                await this.setupFileTransferService(networkDevice, connectionInfo);
                // Download the database
                if (this.options.enableFileTranfer && this.options.downloadDbSources) {
                    await this.downloadDatabase(networkDevice, connectionInfo);
                }
                // Setup other services that should be initialized before StateMap here.
                // StateMap will be initialized after all devices have completed
                // this method. In other words, StateMap will initialize
                // after all entries in this.discoveryStatus return
                // ConnectionStatus.CONNECTED
                // Append to the list of states we need to setup later.
                this.stateMapCallback.push({ connectionInfo, networkDevice });
                // Mark this device as connected.
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
    async setupFileTransferService(networkDevice, connectionInfo) {
        const sourceId = this.sourceId(connectionInfo);
        if (this.options.enableFileTranfer) {
            LogEmitter_1.Logger.info(`Starting file transfer for ${this.deviceId(connectionInfo)}`);
            const fileTransferService = await networkDevice.connectToService(services_1.FileTransfer);
            this.devices.set(`net://${sourceId}`, {
                networkDevice: networkDevice,
                fileTransferService: fileTransferService
            });
        }
        else {
            this.devices.set(`net://${sourceId}`, {
                networkDevice: networkDevice,
                fileTransferService: null
            });
        }
    }
    /**
     * Download databases from the device.
     *
     * @param connectionInfo Connection info
     * @returns
     */
    async downloadDatabase(networkDevice, connectionInfo) {
        const sources = await this.databases.downloadSourcesFromDevice(connectionInfo, networkDevice);
        LogEmitter_1.Logger.debug(`Database sources: ${sources.join(', ')}`);
        LogEmitter_1.Logger.debug(`Database download complete for ${connectionInfo.source}`);
    }
    sourceId(connectionInfo) {
        return /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
            .exec(Buffer.from(connectionInfo.token).toString('hex')).splice(1).join('-');
    }
    /**
     * Setup stateMap.
     *
     * @param connectionInfo Connection info
     * @param networkDevice Network device
     */
    async setupStateMap(connectionInfo, networkDevice) {
        // Setup StateMap
        LogEmitter_1.Logger.debug(`Setting up stateMap for ${connectionInfo.address}`);
        const stateMap = await networkDevice.connectToService(services_1.StateMap);
        stateMap.on('message', (data) => {
            this.emit('message', connectionInfo, data);
        });
        // Setup Player
        const player = new Player_1.Player({
            stateMap: stateMap,
            address: connectionInfo.address,
            port: connectionInfo.port,
            deviceId: this.sourceId(connectionInfo)
        });
        player.on('trackLoaded', (status) => {
            this.emit('trackLoaded', status);
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
        return (device.source === this.options.actingAs.source
            || device.software.name === 'OfflineAnalyzer'
            || /^SoundSwitch/i.test(device.software.name)
            || /^Resolume/i.test(device.software.name)
            || device.software.name === 'JM08' // Ignore X1800/X1850 mixers
            || device.software.name === 'SSS0' // Ignore SoundSwitchEmbedded on players
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