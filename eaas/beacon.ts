/**
 * EAAS Beacon
 *
 * Broadcasts EAAS presence on the network and responds to discovery requests.
 * Use this if you want to act as an EAAS-capable device/server.
 *
 * Ported from go-stagelinq by Carl Kittelberger (icedream)
 * Original: https://github.com/icedream/go-stagelinq
 * License: MIT
 */

import { createSocket, Socket as UDPSocket, RemoteInfo } from 'dgram';
import { EventEmitter } from 'events';
import { networkInterfaces } from 'os';

import { Logger } from '../LogEmitter';
import { generateToken } from '../utils/token';
import {
  EAASBeaconOptions,
  EAAS_DISCOVERY_PORT,
  EAAS_GRPC_PORT,
} from './types';
import {
  createDiscoveryResponse,
  isDiscoveryRequest,
} from './messages';

export declare interface EAASBeacon {
  on(event: 'request', listener: (address: string, port: number) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

/**
 * EAAS Beacon
 *
 * Listens for EAAS discovery requests and responds with device information.
 *
 * @example
 * ```typescript
 * const beacon = new EAASBeacon({
 *   name: 'My EAAS Server',
 *   softwareVersion: '1.0.0',
 *   grpcPort: 50010,
 * });
 *
 * beacon.on('request', (address) => {
 *   console.log(`Discovery request from ${address}`);
 * });
 *
 * await beacon.start();
 * // ... later
 * beacon.stop();
 * ```
 */
export class EAASBeacon extends EventEmitter {
  private options: Required<EAASBeaconOptions>;
  private socket: UDPSocket | null = null;
  private responseMessage: Uint8Array;

  constructor(options: EAASBeaconOptions) {
    super();

    // Generate token if not provided
    const token = options.token ?? generateToken();

    this.options = {
      name: options.name,
      softwareVersion: options.softwareVersion,
      token,
      grpcHost: options.grpcHost ?? '',
      grpcPort: options.grpcPort ?? EAAS_GRPC_PORT,
    };

    // Pre-build response message (will be updated with correct host when bound)
    this.responseMessage = new Uint8Array(0);
  }

  /**
   * Get the beacon's token.
   */
  get token(): Uint8Array {
    return this.options.token;
  }

  /**
   * Get the gRPC port.
   */
  get grpcPort(): number {
    return this.options.grpcPort;
  }

  /**
   * Get the HTTP port (gRPC port + 10).
   */
  get httpPort(): number {
    return this.options.grpcPort + 10;
  }

  /**
   * Start the beacon.
   */
  async start(): Promise<void> {
    if (this.socket) {
      Logger.warn('EAAS Beacon: Already started');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.socket = createSocket({ type: 'udp4', reuseAddr: true });

        this.socket.on('error', (err) => {
          Logger.error(`EAAS Beacon socket error: ${err}`);
          this.emit('error', err);
        });

        this.socket.on('message', (msg: Buffer, rinfo: RemoteInfo) => {
          this.handleMessage(new Uint8Array(msg), rinfo);
        });

        this.socket.on('listening', () => {
          const addr = this.socket!.address();
          Logger.info(`EAAS Beacon: Listening on ${addr.address}:${addr.port}`);

          // Build response message with correct host
          const host = this.options.grpcHost || this.getLocalIP();
          const url = `${host}:${this.options.grpcPort}`;

          this.responseMessage = createDiscoveryResponse(
            this.options.token,
            this.options.name,
            url,
            this.options.softwareVersion
          );

          resolve();
        });

        // Bind to discovery port
        this.socket.bind(EAAS_DISCOVERY_PORT);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Stop the beacon.
   */
  stop(): void {
    if (this.socket) {
      try {
        this.socket.close();
      } catch (err) {
        Logger.warn(`EAAS Beacon: Error closing socket: ${err}`);
      }
      this.socket = null;
      Logger.info('EAAS Beacon: Stopped');
    }
  }

  /**
   * Handle incoming discovery request.
   */
  private handleMessage(data: Uint8Array, rinfo: RemoteInfo): void {
    if (!isDiscoveryRequest(data)) {
      return; // Not a discovery request
    }

    Logger.debug(`EAAS Beacon: Discovery request from ${rinfo.address}:${rinfo.port}`);
    this.emit('request', rinfo.address, rinfo.port);

    // Send response
    this.socket?.send(
      this.responseMessage,
      rinfo.port,
      rinfo.address,
      (err) => {
        if (err) {
          Logger.warn(`EAAS Beacon: Failed to send response to ${rinfo.address}: ${err}`);
        }
      }
    );
  }

  /**
   * Get local IP address for announcement.
   */
  private getLocalIP(): string {
    const interfaces = Object.values(networkInterfaces());

    for (const iface of interfaces) {
      if (!iface) continue;

      for (const entry of iface) {
        if (entry.family === 'IPv4' && !entry.internal) {
          return entry.address;
        }
      }
    }

    return '127.0.0.1';
  }
}
