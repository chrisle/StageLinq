/**
 * EAAS Discoverer
 *
 * Discovers EAAS-enabled devices on the network using UDP broadcasts.
 * Devices respond with their gRPC/HTTP endpoints for further communication.
 *
 * Ported from go-stagelinq by Carl Kittelberger (icedream)
 * Original: https://github.com/icedream/go-stagelinq
 * License: MIT
 */

import { createSocket, Socket as UDPSocket, RemoteInfo } from 'dgram';
import { EventEmitter } from 'events';
import { networkInterfaces } from 'os';
import { subnet } from 'ip';

import { Logger } from '../LogEmitter';
import {
  EAASDevice,
  EAASDiscovererOptions,
  EAAS_DISCOVERY_PORT,
} from './types';
import {
  createDiscoveryRequest,
  parseDiscoveryResponse,
} from './messages';

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_SCAN_INTERVAL = 10000;

export declare interface EAASDiscoverer {
  on(event: 'discovered', listener: (device: EAASDevice) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

/**
 * EAAS Device Discoverer
 *
 * Scans the network for EAAS-enabled devices (Denon DJ hardware with
 * Engine Application & Streaming support).
 *
 * @example
 * ```typescript
 * const discoverer = new EAASDiscoverer();
 *
 * discoverer.on('discovered', (device) => {
 *   console.log(`Found device: ${device.hostname} at ${device.url}`);
 * });
 *
 * // One-time scan
 * const devices = await discoverer.discover();
 *
 * // Or continuous scanning
 * discoverer.startScanning();
 * // ... later
 * discoverer.stopScanning();
 * ```
 */
export class EAASDiscoverer extends EventEmitter {
  private options: Required<EAASDiscovererOptions>;
  private socket: UDPSocket | null = null;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private discoveredDevices: Map<string, EAASDevice> = new Map();

  constructor(options: EAASDiscovererOptions = {}) {
    super();
    this.options = {
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
      scanInterval: options.scanInterval ?? DEFAULT_SCAN_INTERVAL,
    };
  }

  /**
   * Perform a one-time discovery scan.
   *
   * @returns Array of discovered devices
   */
  async discover(): Promise<EAASDevice[]> {
    this.discoveredDevices.clear();

    await this.initSocket();
    await this.broadcast();

    // Wait for responses
    await new Promise((resolve) => setTimeout(resolve, this.options.timeout));

    this.closeSocket();

    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Start continuous scanning for devices.
   * Devices are emitted via the 'discovered' event.
   */
  async startScanning(): Promise<void> {
    if (this.scanTimer) {
      Logger.warn('EAAS: Already scanning');
      return;
    }

    await this.initSocket();

    // Initial broadcast
    await this.broadcast();

    // Schedule periodic broadcasts
    this.scanTimer = setInterval(async () => {
      try {
        await this.broadcast();
      } catch (err) {
        this.emit('error', err);
      }
    }, this.options.scanInterval);

    Logger.info('EAAS: Started scanning for devices');
  }

  /**
   * Stop continuous scanning.
   */
  stopScanning(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }

    this.closeSocket();
    Logger.info('EAAS: Stopped scanning for devices');
  }

  /**
   * Get all discovered devices.
   */
  getDevices(): EAASDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Initialize the UDP socket for discovery.
   */
  private async initSocket(): Promise<void> {
    if (this.socket) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.socket = createSocket({ type: 'udp4', reuseAddr: true });

        this.socket.on('error', (err) => {
          Logger.error(`EAAS discovery socket error: ${err}`);
          this.emit('error', err);
        });

        this.socket.on('message', (msg: Buffer, rinfo: RemoteInfo) => {
          this.handleMessage(new Uint8Array(msg), rinfo.address);
        });

        this.socket.on('listening', () => {
          this.socket!.setBroadcast(true);
          resolve();
        });

        this.socket.bind();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Close the UDP socket.
   */
  private closeSocket(): void {
    if (this.socket) {
      try {
        this.socket.close();
      } catch (err) {
        Logger.warn(`EAAS: Error closing socket: ${err}`);
      }
      this.socket = null;
    }
  }

  /**
   * Broadcast discovery request to all network interfaces.
   */
  private async broadcast(): Promise<void> {
    const request = createDiscoveryRequest();
    const targets = this.getBroadcastTargets();

    if (targets.length === 0) {
      Logger.warn('EAAS: No broadcast targets found');
      return;
    }

    const promises = targets.map((target) => this.sendTo(request, target));
    await Promise.all(promises);

    Logger.debug(`EAAS: Broadcast discovery request to ${targets.length} interfaces`);
  }

  /**
   * Send data to a specific broadcast address.
   */
  private sendTo(data: Uint8Array, address: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve();
        return;
      }

      this.socket.send(data, EAAS_DISCOVERY_PORT, address, (err) => {
        if (err) {
          Logger.warn(`EAAS: Failed to send to ${address}: ${err}`);
        }
        resolve();
      });
    });
  }

  /**
   * Handle incoming discovery response.
   */
  private handleMessage(data: Uint8Array, remoteAddress: string): void {
    const device = parseDiscoveryResponse(data, remoteAddress);

    if (!device) {
      return; // Not a valid EAAS response
    }

    // Use address as key to track unique devices
    const key = `${device.address}:${device.grpcPort}`;

    if (!this.discoveredDevices.has(key)) {
      this.discoveredDevices.set(key, device);
      Logger.info(`EAAS: Discovered device: ${device.hostname} at ${device.address}:${device.grpcPort}`);
      this.emit('discovered', device);
    }
  }

  /**
   * Get broadcast addresses for all network interfaces.
   */
  private getBroadcastTargets(): string[] {
    const interfaces = Object.values(networkInterfaces());
    const targets: string[] = [];

    for (const iface of interfaces) {
      if (!iface) continue;

      for (const entry of iface) {
        if (entry.family === 'IPv4' && !entry.internal) {
          try {
            const info = subnet(entry.address, entry.netmask);
            targets.push(info.broadcastAddress);
          } catch (err) {
            Logger.warn(`EAAS: Failed to get broadcast for ${entry.address}: ${err}`);
          }
        }
      }
    }

    return targets;
  }
}
