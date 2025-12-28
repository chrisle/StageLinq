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

import { Logger } from '../LogEmitter';
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
export class EAASHttpClient {
  private device: EAASDevice;
  private options: Required<EAASHttpClientOptions>;
  private baseUrl: string;

  constructor(device: EAASDevice, options: EAASHttpClientOptions = {}) {
    this.device = device;
    this.options = {
      timeout: options.timeout ?? 30000,
    };
    this.baseUrl = `http://${device.address}:${device.httpPort}`;
  }

  /**
   * Get the device this client is connected to.
   */
  getDevice(): EAASDevice {
    return this.device;
  }

  /**
   * Get the base URL for HTTP requests.
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Ping the device to check if it's reachable.
   *
   * @returns true if device responds, false otherwise
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.fetch('/ping', {
        method: 'GET',
      });
      return response.ok;
    } catch (err) {
      Logger.debug(`EAAS HTTP: Ping failed: ${err}`);
      return false;
    }
  }

  /**
   * Download a file from the device.
   *
   * @param path Remote file path to download
   * @returns File contents as Buffer
   */
  async downloadFile(path: string): Promise<Buffer> {
    // URL-encode the path, preserving slashes
    const encodedPath = path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    const response = await this.fetch(`/download${encodedPath}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get file metadata without downloading the full file.
   *
   * @param path Remote file path
   * @returns File metadata (size, content-type) or null if not found
   */
  async getFileInfo(path: string): Promise<{ size: number; contentType: string } | null> {
    const encodedPath = path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    try {
      const response = await this.fetch(`/download${encodedPath}`, {
        method: 'HEAD',
      });

      if (!response.ok) {
        return null;
      }

      const size = parseInt(response.headers.get('content-length') || '0', 10);
      const contentType = response.headers.get('content-type') || 'application/octet-stream';

      return { size, contentType };
    } catch (err) {
      Logger.debug(`EAAS HTTP: Failed to get file info: ${err}`);
      return null;
    }
  }

  /**
   * Make an HTTP fetch request with timeout.
   */
  private async fetch(path: string, options: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
