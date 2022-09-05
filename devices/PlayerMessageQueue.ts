import { PlayerLayerState } from '../types';

// How long to wait for all the messages to come in before firing the callback.
export const UPDATE_RATE_MS = 2000;

export type DataQueueCallback = (data: PlayerLayerState) => void;

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
export class PlayerMessageQueue {

  private callback: DataQueueCallback;
  private data: PlayerLayerState[] = [];
  private timeout: NodeJS.Timer | null = null;
  private layer: string;

  constructor(layer: string) {
    this.layer = layer;
  }

  /**
   * Push data into the queue.
   * @param data Parsed data from a player.
   */
  push(data: PlayerLayerState) {
    this.data.push(data);
    // console.log('PUSH', data);
    if (!this.timeout) {
      this.timeout = setTimeout(this.emptyCue.bind(this), UPDATE_RATE_MS);
    }
  }

  /**
   * Merge data, empty the queue, clear the timeout, and fire the callback.
   */
  emptyCue() {
    let output: any = { layer: this.layer };
    this.data.map(d => { output = { ...output, ...d }; });
    this.data = [];
    clearTimeout(this.timeout);
    this.timeout = null;
    this.callback(output as PlayerLayerState);
  }

  /**
   * Execute this callback when there is new data from the Denon hardware.
   * @param callback User callback when we have an update.
   * @returns
   */
  onDataReady(callback: DataQueueCallback) {
    this.callback = callback;
    return this;
  }
}
