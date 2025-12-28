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
/// <reference types="node" />
import { EventEmitter } from 'events';
import { EAASBeaconOptions } from './types';
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
export declare class EAASBeacon extends EventEmitter {
    private options;
    private socket;
    private responseMessage;
    constructor(options: EAASBeaconOptions);
    /**
     * Get the beacon's token.
     */
    get token(): Uint8Array;
    /**
     * Get the gRPC port.
     */
    get grpcPort(): number;
    /**
     * Get the HTTP port (gRPC port + 10).
     */
    get httpPort(): number;
    /**
     * Start the beacon.
     */
    start(): Promise<void>;
    /**
     * Stop the beacon.
     */
    stop(): void;
    /**
     * Handle incoming discovery request.
     */
    private handleMessage;
    /**
     * Get local IP address for announcement.
     */
    private getLocalIP;
}
