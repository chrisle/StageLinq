/**
 * TimeSynchronization Service
 *
 * Synchronizes timing between the client and Denon DJ devices.
 * Used for accurate beat-synced operations.
 *
 * Ported from honusz (via chrisle/StageLinq main branch)
 * https://github.com/chrisle/StageLinq
 */
import { ReadContext } from '../utils/ReadContext';
import { Service } from './Service';
import type { ServiceMessage } from '../types';
import { NetworkDevice } from '../network/NetworkDevice';
export interface TimeSyncData {
    /** Message timestamps */
    timestamps: bigint[];
    /** Local timestamp when message was received */
    localTimestamp: bigint;
}
export declare class TimeSync extends Service<TimeSyncData> {
    private localTime;
    private remoteTime;
    private avgTimeArray;
    constructor(address: string, port: number, controller: NetworkDevice);
    /**
     * Initialize the TimeSync service
     */
    protected init(): Promise<void>;
    /**
     * Get current timestamp in milliseconds
     */
    private getTimestamp;
    /**
     * Send a time sync query
     */
    sendTimeSyncQuery(): Promise<void>;
    /**
     * Create a time sync message
     */
    private createTimeSyncMessage;
    /**
     * Parse incoming time sync data
     */
    protected parseData(ctx: ReadContext): ServiceMessage<TimeSyncData>;
    /**
     * Handle parsed time sync messages
     */
    protected messageHandler(msg: ServiceMessage<TimeSyncData>): void;
    /**
     * Update the running average of time differences
     */
    private updateTimeAverage;
    /**
     * Get the current average time offset
     */
    getAverageOffset(): bigint | null;
}
