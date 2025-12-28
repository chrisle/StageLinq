/**
 * Broadcast Service
 *
 * Receives broadcast messages from Denon DJ devices.
 * These messages typically contain database UUIDs, track IDs,
 * and session information.
 *
 * Ported from honusz (via chrisle/StageLinq main branch)
 * https://github.com/chrisle/StageLinq
 */
import { ReadContext } from '../utils/ReadContext';
import { Service } from './Service';
import type { ServiceMessage } from '../types';
import { NetworkDevice } from '../network/NetworkDevice';
export interface BroadcastMessage {
    /** Database UUID */
    databaseUuid?: string;
    /** Track ID */
    trackId?: number | string;
    /** List/playlist ID */
    listId?: number | string;
    /** Session ID */
    sessionId?: number | string;
}
export interface BroadcastData {
    /** The key/type of the broadcast message */
    key?: string;
    /** The broadcast message content */
    value?: BroadcastMessage;
    /** Raw JSON string */
    json?: string;
}
export declare class Broadcast extends Service<BroadcastData> {
    constructor(address: string, port: number, controller: NetworkDevice);
    /**
     * Initialize the Broadcast service
     */
    protected init(): Promise<void>;
    /**
     * Parse incoming broadcast data
     */
    protected parseData(ctx: ReadContext): ServiceMessage<BroadcastData>;
    /**
     * Handle parsed broadcast messages
     */
    protected messageHandler(data: ServiceMessage<BroadcastData>): void;
}
