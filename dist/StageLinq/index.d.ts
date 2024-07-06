/// <reference types="node" />
import { EventEmitter } from 'events';
import { StageLinqDevices } from '../network/StageLinqDevices';
import { Logger } from '../LogEmitter';
import { StageLinqOptions } from '../types';
/**
 * Main StageLinq class.
 */
export declare class StageLinq extends EventEmitter {
    devices: StageLinqDevices;
    logger: Logger;
    options: StageLinqOptions;
    private listener;
    constructor(options?: StageLinqOptions);
    /**
     * Connect to the StageLinq network.
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the StageLinq network.
     */
    disconnect(): Promise<void>;
    get databases(): import("../Databases").Databases;
}
