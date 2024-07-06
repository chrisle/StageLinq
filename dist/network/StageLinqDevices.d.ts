/// <reference types="node" />
import { ConnectionInfo, PlayerStatus, ServiceMessage, StageLinqOptions } from '../types';
import { EventEmitter } from 'events';
import { StateData } from '../services';
import { Databases } from '../Databases';
export declare interface StageLinqDevices {
    on(event: 'trackLoaded', listener: (status: PlayerStatus) => void): this;
    on(event: 'stateChanged', listener: (status: PlayerStatus) => void): this;
    on(event: 'nowPlaying', listener: (status: PlayerStatus) => void): this;
    on(event: 'connected', listener: (connectionInfo: ConnectionInfo) => void): this;
    on(event: 'message', listener: (connectionInfo: ConnectionInfo, message: ServiceMessage<StateData>) => void): this;
    on(event: 'ready', listener: () => void): this;
}
/**
 * Handle connecting and disconnecting from discovered devices on the
 * StageLinq network.
 */
export declare class StageLinqDevices extends EventEmitter {
    private _databases;
    private devices;
    private discoveryStatus;
    private options;
    private deviceWatchTimeout;
    private stateMapCallback;
    constructor(options: StageLinqOptions);
    /**
     * Handle incoming discovery messages from the StageLinq network
     *
     * @param connectionInfo Connection info.
     */
    handleDevice(connectionInfo: ConnectionInfo): Promise<void>;
    /**
     * Disconnect from all connected devices
     */
    disconnectAll(): void;
    get databases(): Databases;
    downloadFile(deviceId: string, path: string): Promise<Uint8Array>;
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
    private waitForAllDevices;
    /**
     * Attempt to connect to a device. Retry if necessary.
     *
     * @param connectionInfo Connection info
     * @returns
     */
    private connectToDevice;
    private setupFileTransferService;
    /**
     * Download databases from the device.
     *
     * @param connectionInfo Connection info
     * @returns
     */
    private downloadDatabase;
    private sourceId;
    /**
     * Setup stateMap.
     *
     * @param connectionInfo Connection info
     * @param networkDevice Network device
     */
    private setupStateMap;
    private deviceId;
    private isConnecting;
    private isConnected;
    private isFailed;
    private isIgnored;
    private isDeviceSeen;
    private showDiscoveryStatus;
}
