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
import { WriteContext } from '../utils/WriteContext';
import { Service } from './Service';
import type { ServiceMessage } from '../types';
import { NetworkDevice } from '../network/NetworkDevice';
import { Logger } from '../LogEmitter';
import { performance } from 'perf_hooks';

export interface TimeSyncData {
  /** Message timestamps */
  timestamps: bigint[];
  /** Local timestamp when message was received */
  localTimestamp: bigint;
}

export class TimeSync extends Service<TimeSyncData> {
  private localTime: bigint = 0n;
  private remoteTime: bigint = 0n;
  private avgTimeArray: bigint[] = [];

  constructor(address: string, port: number, controller: NetworkDevice) {
    super(address, port, controller);
  }

  /**
   * Initialize the TimeSync service
   */
  protected async init(): Promise<void> {
    // TimeSync doesn't need initialization, it responds to device requests
  }

  /**
   * Get current timestamp in milliseconds
   */
  private getTimestamp(): bigint {
    return BigInt(Math.floor(performance.now()));
  }

  /**
   * Send a time sync query
   */
  async sendTimeSyncQuery(): Promise<void> {
    this.localTime = this.getTimestamp();
    const msg = this.createTimeSyncMessage(1, [this.localTime]);
    const ctx = new WriteContext();
    ctx.write(msg);
    await this.write(ctx);
  }

  /**
   * Create a time sync message
   */
  private createTimeSyncMessage(msgId: number, timestamps: bigint[]): Buffer {
    const innerCtx = new WriteContext();
    innerCtx.writeUInt32(msgId);
    for (const ts of timestamps) {
      innerCtx.writeUInt64(ts);
    }
    const message = innerCtx.getBuffer();

    const ctx = new WriteContext();
    ctx.writeUInt32(message.length);
    ctx.write(message);
    return ctx.getBuffer();
  }

  /**
   * Parse incoming time sync data
   */
  protected parseData(ctx: ReadContext): ServiceMessage<TimeSyncData> | null {
    const localTimestamp = this.getTimestamp();
    const size = ctx.readUInt32();

    if (size === 0) {
      // Service announcement - skip for now
      return null;
    }

    const id = ctx.readUInt32();
    const timestamps: bigint[] = [];

    while (ctx.sizeLeft() >= 8) {
      timestamps.push(ctx.readUInt64());
    }

    return {
      id,
      message: {
        timestamps,
        localTimestamp,
      },
    };
  }

  /**
   * Handle parsed time sync messages
   */
  protected messageHandler(msg: ServiceMessage<TimeSyncData>): void {
    if (!msg?.message) {
      return;
    }

    switch (msg.id) {
      case 1:
        // Time sync query from device
        this.remoteTime = msg.message.timestamps[0] || 0n;
        this.sendTimeSyncQuery();
        break;

      case 2:
        // Time sync reply from device
        if (msg.message.timestamps.length >= 2) {
          const remoteClock = msg.message.timestamps[1] - this.remoteTime;
          this.updateTimeAverage(remoteClock);
        }
        break;

      default:
        Logger.debug(`TimeSync: Unknown message id ${msg.id}`);
        break;
    }
  }

  /**
   * Update the running average of time differences
   */
  private updateTimeAverage(time: bigint): void {
    const MAX_SAMPLES = 100;

    if (this.avgTimeArray.length >= MAX_SAMPLES) {
      this.avgTimeArray.shift();
    }
    this.avgTimeArray.push(time);

    if (this.avgTimeArray.length >= MAX_SAMPLES) {
      const sum = this.avgTimeArray.reduce((a, b) => a + b, 0n);
      const avg = sum / BigInt(this.avgTimeArray.length);
      Logger.silly(`TimeSync: Average time offset ${avg}ms`);
    }
  }

  /**
   * Get the current average time offset
   */
  getAverageOffset(): bigint | null {
    if (this.avgTimeArray.length === 0) {
      return null;
    }
    const sum = this.avgTimeArray.reduce((a, b) => a + b, 0n);
    return sum / BigInt(this.avgTimeArray.length);
  }
}
