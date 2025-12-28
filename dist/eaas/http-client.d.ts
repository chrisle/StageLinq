/**
 * EAAS HTTP Client
 *
 * HTTP client for the EAAS HTTP endpoints.
 * Provides access to file downloads and basic health checks.
 *
 * Ported from go-stagelinq by Carl Kittelberger (icedream)
 * Original: https://github.com/icedream/go-stagelinq
 * License: MIT
 */
/// <reference types="node" />
import { EAASDevice } from './types';
export interface EAASHttpClientOptions {
    /** Request timeout in milliseconds */
    timeout?: number;
}
/**
 * EAAS HTTP Client
 *
 * Connects to an EAAS-enabled device's HTTP endpoints for file downloads
 * and health checks.
 *
 * @example
 * ```typescript
 * const client = new EAASHttpClient(device);
 *
 * // Check if device is reachable
 * const isAlive = await client.ping();
 * console.log('Device alive:', isAlive);
 *
 * // Download a file
 * const data = await client.downloadFile('/path/to/file.mp3');
 * fs.writeFileSync('local.mp3', data);
 * ```
 */
export declare class EAASHttpClient {
    private device;
    private options;
    private baseUrl;
    constructor(device: EAASDevice, options?: EAASHttpClientOptions);
    /**
     * Get the device this client is connected to.
     */
    getDevice(): EAASDevice;
    /**
     * Get the base URL for HTTP requests.
     */
    getBaseUrl(): string;
    /**
     * Ping the device to check if it's reachable.
     *
     * @returns true if device responds, false otherwise
     */
    ping(): Promise<boolean>;
    /**
     * Download a file from the device.
     *
     * @param path Remote file path to download
     * @returns File contents as Buffer
     */
    downloadFile(path: string): Promise<Buffer>;
    /**
     * Get file metadata without downloading the full file.
     *
     * @param path Remote file path
     * @returns File metadata (size, content-type) or null if not found
     */
    getFileInfo(path: string): Promise<{
        size: number;
        contentType: string;
    } | null>;
    /**
     * Make an HTTP fetch request with timeout.
     */
    private fetch;
}
