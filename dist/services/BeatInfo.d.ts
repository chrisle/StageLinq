/**
 * BeatInfo Service
 *
 * Provides real-time beat information from Denon DJ devices including:
 * - Current beat position
 * - Total beats in track
 * - BPM (beats per minute)
 * - Sample position
 *
 * Ported from honusz (via chrisle/StageLinq main branch)
 * https://github.com/chrisle/StageLinq
 */
import { ReadContext } from '../utils/ReadContext';
import { Service } from './Service';
import type { ServiceMessage } from '../types';
import { NetworkDevice } from '../network/NetworkDevice';
export interface DeckBeatData {
    /** Current beat position in the track */
    beat: number;
    /** Total number of beats in the track */
    totalBeats: number;
    /** Current BPM */
    bpm: number;
    /** Sample position (optional) */
    samples?: number;
}
export interface BeatData {
    /** Timestamp/clock value */
    clock: bigint;
    /** Number of decks */
    deckCount: number;
    /** Beat data for each deck */
    decks: DeckBeatData[];
}
export interface BeatInfoOptions {
    /** Emit beat events every N beats (0 = every beat) */
    everyNBeats?: number;
}
export declare class BeatInfo extends Service<BeatData> {
    private currentBeatData;
    private options;
    constructor(address: string, port: number, controller: NetworkDevice);
    /**
     * Initialize the BeatInfo service by subscribing to beat data
     */
    protected init(): Promise<void>;
    /**
     * Configure beat info options
     */
    setOptions(options: BeatInfoOptions): void;
    /**
     * Get the current beat data
     */
    getBeatData(): BeatData | null;
    /**
     * Send subscription request to receive beat info
     */
    private subscribeToBeatInfo;
    /**
     * Parse incoming beat data
     */
    protected parseData(ctx: ReadContext): ServiceMessage<BeatData>;
    /**
     * Handle parsed beat messages
     */
    protected messageHandler(data: ServiceMessage<BeatData>): void;
    /**
     * Determine if we should emit a beat event based on options
     */
    private shouldEmitBeat;
}
