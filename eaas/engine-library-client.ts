/**
 * Engine Library Client
 *
 * gRPC client for the EAAS EngineLibraryService.
 * Provides access to music libraries, tracks, playlists, and streaming events.
 *
 * Note: This is a placeholder implementation. Full gRPC support requires:
 * 1. Install @grpc/grpc-js and google-protobuf dependencies
 * 2. Add .proto files to the repository
 * 3. Generate TypeScript bindings using protoc with ts-proto plugin
 * 4. Update this file to use the generated client stubs
 *
 * Ported from go-stagelinq by Carl Kittelberger (icedream)
 * Original: https://github.com/icedream/go-stagelinq
 * License: MIT
 */

import { EventEmitter } from 'events';
import { Logger } from '../LogEmitter';
import { EAASDevice } from './types';
import {
  GetLibrariesRequest,
  GetLibrariesResponse,
  GetLibraryRequest,
  GetLibraryResponse,
  GetTracksRequest,
  GetTracksResponse,
  GetTrackRequest,
  GetTrackResponse,
  SearchTracksRequest,
  SearchTracksResponse,
  GetSearchFiltersRequest,
  GetSearchFiltersResponse,
  GetHistorySessionsRequest,
  GetHistorySessionsResponse,
  GetHistoryPlayedTracksRequest,
  GetHistoryPlayedTracksResponse,
  EventStreamRequest,
  LibraryEvent,
} from './grpc-types';

export interface EngineLibraryClientOptions {
  /** Connection timeout in milliseconds */
  timeout?: number;
}

export declare interface EngineLibraryClient {
  on(event: 'connected', listener: () => void): this;
  on(event: 'disconnected', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'libraryEvent', listener: (event: LibraryEvent) => void): this;
}

/**
 * Engine Library gRPC Client
 *
 * Connects to an EAAS-enabled device and provides access to the
 * EngineLibraryService gRPC API.
 *
 * @example
 * ```typescript
 * const client = new EngineLibraryClient(device);
 * await client.connect();
 *
 * const libraries = await client.getLibraries();
 * console.log('Available libraries:', libraries);
 *
 * for (const lib of libraries) {
 *   const tracks = await client.getTracks({ libraryId: lib.id });
 *   console.log(`${lib.title}: ${tracks.totalCount} tracks`);
 * }
 *
 * await client.disconnect();
 * ```
 */
export class EngineLibraryClient extends EventEmitter {
  private device: EAASDevice;
  private _options: Required<EngineLibraryClientOptions>;
  private connected = false;
  // private grpcClient: any = null; // Placeholder for actual gRPC client

  constructor(device: EAASDevice, options: EngineLibraryClientOptions = {}) {
    super();
    this.device = device;
    this._options = {
      timeout: options.timeout ?? 10000,
    };
  }

  /**
   * Get the client options.
   */
  get options(): Required<EngineLibraryClientOptions> {
    return this._options;
  }

  /**
   * Get the device this client is connected to.
   */
  getDevice(): EAASDevice {
    return this.device;
  }

  /**
   * Check if client is connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Connect to the device's gRPC service.
   *
   * @throws Error if gRPC is not available (placeholder implementation)
   */
  async connect(): Promise<void> {
    if (this.connected) {
      Logger.warn('EAAS: Already connected');
      return;
    }

    const endpoint = `${this.device.address}:${this.device.grpcPort}`;
    Logger.info(`EAAS: Connecting to ${endpoint}`);

    // TODO: Implement actual gRPC connection
    // This requires @grpc/grpc-js and generated proto bindings
    //
    // Example implementation:
    // ```
    // const { EngineLibraryServiceClient } = require('./proto/enginelibrary_grpc_pb');
    // const grpc = require('@grpc/grpc-js');
    //
    // this.grpcClient = new EngineLibraryServiceClient(
    //   endpoint,
    //   grpc.credentials.createInsecure()
    // );
    // ```

    throw new Error(
      'gRPC not implemented. Install @grpc/grpc-js and generate proto bindings. ' +
      'See eaas/README.md for setup instructions.'
    );
  }

  /**
   * Disconnect from the device.
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    // TODO: Close gRPC client
    // this.grpcClient?.close();
    // this.grpcClient = null;

    this.connected = false;
    this.emit('disconnected');
    Logger.info('EAAS: Disconnected');
  }

  /**
   * Get all available music libraries.
   */
  async getLibraries(_request: GetLibrariesRequest = {}): Promise<GetLibrariesResponse> {
    this.ensureConnected();

    // TODO: Implement gRPC call
    // return new Promise((resolve, reject) => {
    //   this.grpcClient.getLibraries(request, (err, response) => {
    //     if (err) reject(err);
    //     else resolve(response);
    //   });
    // });

    throw new Error('gRPC not implemented');
  }

  /**
   * Get playlist structure for a library.
   */
  async getLibrary(_request: GetLibraryRequest): Promise<GetLibraryResponse> {
    this.ensureConnected();
    throw new Error('gRPC not implemented');
  }

  /**
   * Get tracks from a library or playlist.
   */
  async getTracks(_request: GetTracksRequest): Promise<GetTracksResponse> {
    this.ensureConnected();
    throw new Error('gRPC not implemented');
  }

  /**
   * Get detailed information about a specific track.
   */
  async getTrack(_request: GetTrackRequest): Promise<GetTrackResponse> {
    this.ensureConnected();
    throw new Error('gRPC not implemented');
  }

  /**
   * Search for tracks in a library.
   */
  async searchTracks(_request: SearchTracksRequest): Promise<SearchTracksResponse> {
    this.ensureConnected();
    throw new Error('gRPC not implemented');
  }

  /**
   * Get available filter options for a library/playlist.
   */
  async getSearchFilters(_request: GetSearchFiltersRequest): Promise<GetSearchFiltersResponse> {
    this.ensureConnected();
    throw new Error('gRPC not implemented');
  }

  /**
   * Get history sessions.
   */
  async getHistorySessions(_request: GetHistorySessionsRequest): Promise<GetHistorySessionsResponse> {
    this.ensureConnected();
    throw new Error('gRPC not implemented');
  }

  /**
   * Get played tracks from history.
   */
  async getHistoryPlayedTracks(_request: GetHistoryPlayedTracksRequest): Promise<GetHistoryPlayedTracksResponse> {
    this.ensureConnected();
    throw new Error('gRPC not implemented');
  }

  /**
   * Subscribe to library events.
   * Events are emitted via the 'libraryEvent' event.
   */
  async subscribeToEvents(_request: EventStreamRequest = {}): Promise<void> {
    this.ensureConnected();

    // TODO: Implement gRPC streaming
    // const stream = this.grpcClient.eventStream(request);
    // stream.on('data', (response) => {
    //   for (const event of response.events) {
    //     this.emit('libraryEvent', event);
    //   }
    // });
    // stream.on('error', (err) => this.emit('error', err));
    // stream.on('end', () => Logger.info('EAAS: Event stream ended'));

    throw new Error('gRPC not implemented');
  }

  /**
   * Ensure client is connected before making requests.
   */
  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }
  }
}
