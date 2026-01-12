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
import { WriteContext } from '../utils/WriteContext';
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

export class BeatInfo extends Service<BeatData> {
  private currentBeatData: BeatData | null = null;
  private options: BeatInfoOptions = { everyNBeats: 0 };

  constructor(address: string, port: number, controller: NetworkDevice) {
    super(address, port, controller);
  }

  /**
   * Initialize the BeatInfo service by subscribing to beat data
   */
  protected async init(): Promise<void> {
    await this.subscribeToBeatInfo();
  }

  /**
   * Configure beat info options
   */
  setOptions(options: BeatInfoOptions): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get the current beat data
   */
  getBeatData(): BeatData | null {
    return this.currentBeatData;
  }

  /**
   * Send subscription request to receive beat info
   */
  private async subscribeToBeatInfo(): Promise<void> {
    const ctx = new WriteContext();
    // BeatInfo subscription message: 8 bytes of zeros
    ctx.write(new Uint8Array([0x0, 0x0, 0x0, 0x4, 0x0, 0x0, 0x0, 0x0]));
    await this.write(ctx);
  }

  /**
   * Parse incoming beat data
   */
  protected parseData(ctx: ReadContext): ServiceMessage<BeatData> | null {
    // BeatInfo messages are at least 72 bytes
    // Format: id (4) + clock (8) + deckCount (4) + deckData (deckCount * 24) + samples (deckCount * 8)
    if (ctx.sizeLeft() < 20) {
      return null;
    }

    const id = ctx.readUInt32();
    const clock = ctx.readUInt64();
    const deckCount = ctx.readUInt32();

    const decks: DeckBeatData[] = [];

    // Read beat data for each deck
    for (let i = 0; i < deckCount; i++) {
      decks.push({
        beat: ctx.readFloat64(),
        totalBeats: ctx.readFloat64(),
        bpm: ctx.readFloat64(),
      });
    }

    // Read sample positions for each deck
    for (let i = 0; i < deckCount; i++) {
      if (ctx.sizeLeft() >= 8) {
        decks[i].samples = ctx.readFloat64();
      }
    }

    const message: ServiceMessage<BeatData> = {
      id,
      message: {
        clock,
        deckCount,
        decks,
      },
    };

    return message;
  }

  /**
   * Handle parsed beat messages
   */
  protected messageHandler(data: ServiceMessage<BeatData>): void {
    if (!data?.message) {
      return;
    }

    const shouldEmit = this.shouldEmitBeat(data.message);
    this.currentBeatData = data.message;

    if (shouldEmit) {
      this.emit('beatMessage', data.message);
    }
  }

  /**
   * Determine if we should emit a beat event based on options
   */
  private shouldEmitBeat(newData: BeatData): boolean {
    const everyN = this.options.everyNBeats || 0;

    // Always emit if no filtering
    if (everyN === 0) {
      return true;
    }

    // First beat data, always emit
    if (!this.currentBeatData) {
      return true;
    }

    // Check if any deck crossed a beat boundary
    for (let i = 0; i < newData.deckCount; i++) {
      const prevBeat = this.currentBeatData.decks[i]?.beat || 0;
      const currentBeat = newData.decks[i].beat;

      const prevBeatN = Math.floor(prevBeat / everyN);
      const currentBeatN = Math.floor(currentBeat / everyN);

      if (prevBeatN !== currentBeatN) {
        return true;
      }
    }

    return false;
  }
}
