"use strict";
/**
 * StageLinq - Main entry point for the StageLinq library
 *
 * Supports two usage patterns:
 *
 * 1. Static class (compatible with TS main v1):
 *    StageLinq.options = { actingAs: ActingAsDevice.NowPlaying };
 *    StageLinq.on('trackLoaded', (track) => console.log(track));
 *    await StageLinq.connect();
 *
 * 2. Instance-based (for flexibility):
 *    const stagelinq = new StageLinqInstance(options);
 *    stagelinq.on('trackLoaded', (track) => console.log(track));
 *    await stagelinq.connect();
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageLinq = exports.StageLinqInstance = void 0;
const network_1 = require("../network");
const events_1 = require("events");
const StageLinqDevices_1 = require("../network/StageLinqDevices");
const LogEmitter_1 = require("../LogEmitter");
const types_1 = require("../types");
const DEFAULT_OPTIONS = {
    maxRetries: 3,
    actingAs: types_1.ActingAsDevice.NowPlaying,
    downloadDbSources: true,
    enableFileTranfer: true
};
/**
 * StageLinq instance class.
 * Use this for multiple instances or when you need full control.
 */
class StageLinqInstance extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.instanceLogger = LogEmitter_1.Logger.instance;
        this._isConnected = false;
        this.instanceOptions = { ...DEFAULT_OPTIONS, ...options };
        this.devices = new StageLinqDevices_1.StageLinqDevices(this.instanceOptions);
        // Forward device events to this instance
        this.devices.on('connected', (info) => this.emit('connected', info));
        this.devices.on('ready', () => this.emit('ready'));
        this.devices.on('trackLoaded', (status) => this.emit('trackLoaded', status));
        this.devices.on('nowPlaying', (status) => this.emit('nowPlaying', status));
        this.devices.on('stateChanged', (status) => this.emit('stateChanged', status));
        this.devices.on('message', (info, data) => this.emit('message', info, data));
    }
    /**
     * Whether the instance is currently connected
     */
    get isConnected() {
        return this._isConnected;
    }
    /**
     * Get the options
     */
    get options() {
        return this.instanceOptions;
    }
    /**
     * Get the logger
     */
    get logger() {
        return this.instanceLogger;
    }
    /**
     * Connect to the StageLinq network.
     */
    async connect() {
        if (this._isConnected) {
            LogEmitter_1.Logger.warn('Already connected');
            return;
        }
        this.listener = new network_1.StageLinqListener();
        const msg = (0, network_1.createDiscoveryMessage)(types_1.Action.Login, this.instanceOptions.actingAs);
        await (0, network_1.announce)(msg);
        this.listener.listenForDevices(async (connectionInfo) => {
            await this.devices.handleDevice(connectionInfo);
        });
        this._isConnected = true;
        this.emit('listening');
    }
    /**
     * Disconnect from the StageLinq network.
     */
    async disconnect() {
        if (!this._isConnected) {
            LogEmitter_1.Logger.warn('Not connected');
            return;
        }
        try {
            this.devices.disconnectAll();
            const msg = (0, network_1.createDiscoveryMessage)(types_1.Action.Logout, this.instanceOptions.actingAs);
            await (0, network_1.unannounce)(msg);
            this._isConnected = false;
            this.emit('disconnected');
        }
        catch (e) {
            this.emit('error', e);
            throw new Error(e);
        }
    }
    /**
     * Get the databases manager
     */
    get databases() {
        return this.devices.databases;
    }
}
exports.StageLinqInstance = StageLinqInstance;
/**
 * StageLinq static class.
 * Provides a singleton interface compatible with TS main v1.
 *
 * @example
 * StageLinq.options = { actingAs: ActingAsDevice.NowPlaying };
 * StageLinq.devices.on('trackLoaded', (track) => console.log(track));
 * await StageLinq.connect();
 */
class StageLinq {
    /**
     * Get or set the options for the static instance
     * Compatible with TS main v1: StageLinq.options = { ... }
     */
    static get options() {
        return this._options;
    }
    static set options(value) {
        this._options = { ...DEFAULT_OPTIONS, ...value };
        // Reset instance if options change before connection
        if (this._instance && !this._instance.isConnected) {
            this._instance = null;
        }
    }
    /**
     * Get the singleton instance, creating it if necessary
     */
    static get instance() {
        if (!this._instance) {
            this._instance = new StageLinqInstance(this._options);
        }
        return this._instance;
    }
    /**
     * Whether the static instance is currently connected
     */
    static get isConnected() {
        return this._instance?.isConnected ?? false;
    }
    /**
     * Get the devices manager
     * Compatible with TS main v1: StageLinq.devices
     */
    static get devices() {
        return this.instance.devices;
    }
    /**
     * Get the databases manager
     */
    static get databases() {
        return this.instance.databases;
    }
    /**
     * Get the logger instance
     * Compatible with TS main v1: StageLinq.logger
     */
    static get logger() {
        return this.instance.logger;
    }
    /**
     * Connect to the StageLinq network
     * Compatible with TS main v1: await StageLinq.connect()
     */
    static async connect() {
        return this.instance.connect();
    }
    /**
     * Disconnect from the StageLinq network
     * Compatible with TS main v1: await StageLinq.disconnect()
     */
    static async disconnect() {
        return this.instance.disconnect();
    }
    /**
     * Register an event listener
     */
    static on(event, listener) {
        this.instance.on(event, listener);
    }
    /**
     * Register a one-time event listener
     */
    static once(event, listener) {
        this.instance.once(event, listener);
    }
    /**
     * Remove an event listener
     */
    static off(event, listener) {
        this.instance.off(event, listener);
    }
    /**
     * Remove all listeners for an event
     */
    static removeAllListeners(event) {
        this.instance.removeAllListeners(event);
    }
    /**
     * Emit an event
     */
    static emit(event, ...args) {
        return this.instance.emit(event, ...args);
    }
    /**
     * Reset the static instance (for testing or reconfiguration)
     */
    static reset() {
        if (this._instance) {
            if (this._instance.isConnected) {
                LogEmitter_1.Logger.warn('Cannot reset while connected. Call disconnect() first.');
                return;
            }
            this._instance = null;
        }
    }
}
exports.StageLinq = StageLinq;
StageLinq._instance = null;
StageLinq._options = { ...DEFAULT_OPTIONS };
exports.default = StageLinq;
//# sourceMappingURL=index.js.map