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

import { announce, createDiscoveryMessage, StageLinqListener, unannounce } from '../network';
import { EventEmitter } from 'events';
import { StageLinqDevices } from '../network/StageLinqDevices';
import { Logger } from '../LogEmitter';
import { Action, ActingAsDevice, StageLinqOptions } from '../types';
import { setConfig } from '../config';

const DEFAULT_OPTIONS: StageLinqOptions = {
  maxRetries: 3,
  actingAs: ActingAsDevice.NowPlaying,
  downloadDbSources: true,
  enableFileTranfer: true
};

/**
 * StageLinq instance class.
 * Use this for multiple instances or when you need full control.
 */
export class StageLinqInstance extends EventEmitter {
  devices: StageLinqDevices;
  instanceLogger: Logger = Logger.instance;
  instanceOptions: StageLinqOptions;

  private listener: StageLinqListener;
  private _isConnected: boolean = false;

  constructor(options?: StageLinqOptions) {
    super();
    this.instanceOptions = { ...DEFAULT_OPTIONS, ...options };

    // Apply global config from options
    if (this.instanceOptions.networkTap) {
      setConfig({ networkTap: this.instanceOptions.networkTap });
    }

    this.devices = new StageLinqDevices(this.instanceOptions);

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
  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Get the options
   */
  get options(): StageLinqOptions {
    return this.instanceOptions;
  }

  /**
   * Get the logger
   */
  get logger(): Logger {
    return this.instanceLogger;
  }

  /**
   * Connect to the StageLinq network.
   */
  async connect(): Promise<void> {
    if (this._isConnected) {
      Logger.warn('Already connected');
      return;
    }

    this.listener = new StageLinqListener();
    const msg = createDiscoveryMessage(Action.Login, this.instanceOptions.actingAs);
    await announce(msg);
    this.listener.listenForDevices(async (connectionInfo) => {
      await this.devices.handleDevice(connectionInfo);
    });
    this._isConnected = true;
    this.emit('listening');
  }

  /**
   * Disconnect from the StageLinq network.
   */
  async disconnect(): Promise<void> {
    if (!this._isConnected) {
      Logger.warn('Not connected');
      return;
    }

    try {
      this.devices.disconnectAll();
      this.listener?.stop();
      const msg = createDiscoveryMessage(Action.Logout, this.instanceOptions.actingAs);
      await unannounce(msg);
      this._isConnected = false;
      this.emit('disconnected');
    } catch (e) {
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

/**
 * StageLinq static class.
 * Provides a singleton interface compatible with TS main v1.
 *
 * @example
 * StageLinq.options = { actingAs: ActingAsDevice.NowPlaying };
 * StageLinq.devices.on('trackLoaded', (track) => console.log(track));
 * await StageLinq.connect();
 */
export class StageLinq {
  private static _instance: StageLinqInstance | null = null;
  private static _options: StageLinqOptions = { ...DEFAULT_OPTIONS };

  /**
   * Get or set the options for the static instance
   * Compatible with TS main v1: StageLinq.options = { ... }
   */
  static get options(): StageLinqOptions {
    return this._options;
  }

  static set options(value: StageLinqOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...value };
    // Reset instance if options change before connection
    if (this._instance && !this._instance.isConnected) {
      this._instance = null;
    }
  }

  /**
   * Get the singleton instance, creating it if necessary
   */
  private static get instance(): StageLinqInstance {
    if (!this._instance) {
      this._instance = new StageLinqInstance(this._options);
    }
    return this._instance;
  }

  /**
   * Whether the static instance is currently connected
   */
  static get isConnected(): boolean {
    return this._instance?.isConnected ?? false;
  }

  /**
   * Get the devices manager
   * Compatible with TS main v1: StageLinq.devices
   */
  static get devices(): StageLinqDevices {
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
  static get logger(): Logger {
    return this.instance.logger;
  }

  /**
   * Connect to the StageLinq network
   * Compatible with TS main v1: await StageLinq.connect()
   */
  static async connect(): Promise<void> {
    return this.instance.connect();
  }

  /**
   * Disconnect from the StageLinq network
   * Compatible with TS main v1: await StageLinq.disconnect()
   */
  static async disconnect(): Promise<void> {
    return this.instance.disconnect();
  }

  /**
   * Register an event listener
   */
  static on(event: string, listener: (...args: any[]) => void): void {
    this.instance.on(event, listener);
  }

  /**
   * Register a one-time event listener
   */
  static once(event: string, listener: (...args: any[]) => void): void {
    this.instance.once(event, listener);
  }

  /**
   * Remove an event listener
   */
  static off(event: string, listener: (...args: any[]) => void): void {
    this.instance.off(event, listener);
  }

  /**
   * Remove all listeners for an event
   */
  static removeAllListeners(event?: string): void {
    this.instance.removeAllListeners(event);
  }

  /**
   * Emit an event
   */
  static emit(event: string, ...args: any[]): boolean {
    return this.instance.emit(event, ...args);
  }

  /**
   * Reset the static instance (for testing or reconfiguration)
   */
  static reset(): void {
    if (this._instance) {
      if (this._instance.isConnected) {
        Logger.warn('Cannot reset while connected. Call disconnect() first.');
        return;
      }
      this._instance = null;
    }
  }
}

export default StageLinq;
