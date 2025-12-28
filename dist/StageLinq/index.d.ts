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
/// <reference types="node" />
import { EventEmitter } from 'events';
import { StageLinqDevices } from '../network/StageLinqDevices';
import { Logger } from '../LogEmitter';
import { StageLinqOptions } from '../types';
/**
 * StageLinq instance class.
 * Use this for multiple instances or when you need full control.
 */
export declare class StageLinqInstance extends EventEmitter {
    devices: StageLinqDevices;
    instanceLogger: Logger;
    instanceOptions: StageLinqOptions;
    private listener;
    private _isConnected;
    constructor(options?: StageLinqOptions);
    /**
     * Whether the instance is currently connected
     */
    get isConnected(): boolean;
    /**
     * Get the options
     */
    get options(): StageLinqOptions;
    /**
     * Get the logger
     */
    get logger(): Logger;
    /**
     * Connect to the StageLinq network.
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the StageLinq network.
     */
    disconnect(): Promise<void>;
    /**
     * Get the databases manager
     */
    get databases(): import("../Databases").Databases;
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
export declare class StageLinq {
    private static _instance;
    private static _options;
    /**
     * Get or set the options for the static instance
     * Compatible with TS main v1: StageLinq.options = { ... }
     */
    static get options(): StageLinqOptions;
    static set options(value: StageLinqOptions);
    /**
     * Get the singleton instance, creating it if necessary
     */
    private static get instance();
    /**
     * Whether the static instance is currently connected
     */
    static get isConnected(): boolean;
    /**
     * Get the devices manager
     * Compatible with TS main v1: StageLinq.devices
     */
    static get devices(): StageLinqDevices;
    /**
     * Get the databases manager
     */
    static get databases(): import("../Databases").Databases;
    /**
     * Get the logger instance
     * Compatible with TS main v1: StageLinq.logger
     */
    static get logger(): Logger;
    /**
     * Connect to the StageLinq network
     * Compatible with TS main v1: await StageLinq.connect()
     */
    static connect(): Promise<void>;
    /**
     * Disconnect from the StageLinq network
     * Compatible with TS main v1: await StageLinq.disconnect()
     */
    static disconnect(): Promise<void>;
    /**
     * Register an event listener
     */
    static on(event: string, listener: (...args: any[]) => void): void;
    /**
     * Register a one-time event listener
     */
    static once(event: string, listener: (...args: any[]) => void): void;
    /**
     * Remove an event listener
     */
    static off(event: string, listener: (...args: any[]) => void): void;
    /**
     * Remove all listeners for an event
     */
    static removeAllListeners(event?: string): void;
    /**
     * Emit an event
     */
    static emit(event: string, ...args: any[]): boolean;
    /**
     * Reset the static instance (for testing or reconfiguration)
     */
    static reset(): void;
}
export default StageLinq;
