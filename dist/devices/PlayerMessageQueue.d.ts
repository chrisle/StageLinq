import { PlayerLayerState } from '../types';
export declare const UPDATE_RATE_MS = 1500;
export declare type DataQueueCallback = (data: PlayerLayerState) => void;
/**
 * Collect all the messages from a player together and return it as one object.
 *
 * The Denon hardware will fire several messages in quick succession. This will
 * take them all in, then after UPDATE_RATE_MS will merge all the data
 * as a single update to the `onDataReady` callback.
 *
 * For example, when you move the fader up you get several ExternalMixerVolume
 * messages where the value goes up from 0 to 1. Instead firing off loads
 * of updates we're only interested in the last one.
 */
export declare class PlayerMessageQueue {
    private callback;
    private data;
    private timeout;
    private layer;
    constructor(layer: string);
    /**
     * Push data into the queue.
     * @param data Parsed data from a player.
     */
    push(data: PlayerLayerState): void;
    /**
     * Merge data, empty the queue, clear the timeout, and fire the callback.
     */
    emptyCue(): void;
    /**
     * Execute this callback when there is new data from the Denon hardware.
     * @param callback User callback when we have an update.
     * @returns
     */
    onDataReady(callback: DataQueueCallback): this;
}
