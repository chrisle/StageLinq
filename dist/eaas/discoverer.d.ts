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
/// <reference types="node" />
import { EventEmitter } from 'events';
import { EAASDevice, EAASDiscovererOptions } from './types';
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
export declare class EAASDiscoverer extends EventEmitter {
    private options;
    private socket;
    private scanTimer;
    private discoveredDevices;
    constructor(options?: EAASDiscovererOptions);
    /**
     * Perform a one-time discovery scan.
     *
     * @returns Array of discovered devices
     */
    discover(): Promise<EAASDevice[]>;
    /**
     * Start continuous scanning for devices.
     * Devices are emitted via the 'discovered' event.
     */
    startScanning(): Promise<void>;
    /**
     * Stop continuous scanning.
     */
    stopScanning(): void;
    /**
     * Get all discovered devices.
     */
    getDevices(): EAASDevice[];
    /**
     * Initialize the UDP socket for discovery.
     */
    private initSocket;
    /**
     * Close the UDP socket.
     */
    private closeSocket;
    /**
     * Broadcast discovery request to all network interfaces.
     */
    private broadcast;
    /**
     * Send data to a specific broadcast address.
     */
    private sendTo;
    /**
     * Handle incoming discovery response.
     */
    private handleMessage;
    /**
     * Get broadcast addresses for all network interfaces.
     */
    private getBroadcastTargets;
}
