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

export class Broadcast extends Service<BroadcastData> {
  constructor(address: string, port: number, controller: NetworkDevice) {
    super(address, port, controller);
  }

  /**
   * Initialize the Broadcast service
   */
  protected async init(): Promise<void> {
    // Broadcast doesn't need initialization, it receives messages
  }

  /**
   * Parse incoming broadcast data
   */
  protected parseData(ctx: ReadContext): ServiceMessage<BroadcastData> {
    const length = ctx.readUInt32();

    if (length === 0 && ctx.sizeLeft() > 0) {
      // Service announcement message
      ctx.seek(16); // Skip device ID
      const name = ctx.readNetworkStringUTF16();
      const port = ctx.readUInt16();

      return {
        id: 0,
        message: {
          key: 'serviceAnnouncement',
          value: {
            databaseUuid: name,
            trackId: port,
          },
        },
      };
    }

    if (length > 0) {
      // JSON message
      const jsonStr = ctx.getString(length);

      return {
        id: length,
        message: {
          json: jsonStr,
        },
      };
    }

    return null;
  }

  /**
   * Handle parsed broadcast messages
   */
  protected messageHandler(data: ServiceMessage<BroadcastData>): void {
    if (!data?.message) {
      return;
    }

    if (data.message.json) {
      try {
        // Parse the JSON and clean up any dots in keys
        const cleanJson = data.message.json.replace(/\./g, '');
        const parsed = JSON.parse(cleanJson);

        const key = Object.keys(parsed)[0];
        const value = Object.values(parsed)[0] as BroadcastMessage;

        this.emit('broadcastMessage', {
          key,
          value,
        });

        // Also emit by database UUID for specific listeners
        if (value?.databaseUuid) {
          this.emit(`db:${value.databaseUuid}`, { key, value });
        }
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
  }
}
