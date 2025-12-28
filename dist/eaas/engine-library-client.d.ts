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
/// <reference types="node" />
import { EventEmitter } from 'events';
import { EAASDevice } from './types';
import { GetLibrariesRequest, GetLibrariesResponse, GetLibraryRequest, GetLibraryResponse, GetTracksRequest, GetTracksResponse, GetTrackRequest, GetTrackResponse, SearchTracksRequest, SearchTracksResponse, GetSearchFiltersRequest, GetSearchFiltersResponse, GetHistorySessionsRequest, GetHistorySessionsResponse, GetHistoryPlayedTracksRequest, GetHistoryPlayedTracksResponse, EventStreamRequest, LibraryEvent } from './grpc-types';
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
export declare class EngineLibraryClient extends EventEmitter {
    private device;
    private _options;
    private connected;
    constructor(device: EAASDevice, options?: EngineLibraryClientOptions);
    /**
     * Get the client options.
     */
    get options(): Required<EngineLibraryClientOptions>;
    /**
     * Get the device this client is connected to.
     */
    getDevice(): EAASDevice;
    /**
     * Check if client is connected.
     */
    isConnected(): boolean;
    /**
     * Connect to the device's gRPC service.
     *
     * @throws Error if gRPC is not available (placeholder implementation)
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the device.
     */
    disconnect(): Promise<void>;
    /**
     * Get all available music libraries.
     */
    getLibraries(_request?: GetLibrariesRequest): Promise<GetLibrariesResponse>;
    /**
     * Get playlist structure for a library.
     */
    getLibrary(_request: GetLibraryRequest): Promise<GetLibraryResponse>;
    /**
     * Get tracks from a library or playlist.
     */
    getTracks(_request: GetTracksRequest): Promise<GetTracksResponse>;
    /**
     * Get detailed information about a specific track.
     */
    getTrack(_request: GetTrackRequest): Promise<GetTrackResponse>;
    /**
     * Search for tracks in a library.
     */
    searchTracks(_request: SearchTracksRequest): Promise<SearchTracksResponse>;
    /**
     * Get available filter options for a library/playlist.
     */
    getSearchFilters(_request: GetSearchFiltersRequest): Promise<GetSearchFiltersResponse>;
    /**
     * Get history sessions.
     */
    getHistorySessions(_request: GetHistorySessionsRequest): Promise<GetHistorySessionsResponse>;
    /**
     * Get played tracks from history.
     */
    getHistoryPlayedTracks(_request: GetHistoryPlayedTracksRequest): Promise<GetHistoryPlayedTracksResponse>;
    /**
     * Subscribe to library events.
     * Events are emitted via the 'libraryEvent' event.
     */
    subscribeToEvents(_request?: EventStreamRequest): Promise<void>;
    /**
     * Ensure client is connected before making requests.
     */
    private ensureConnected;
}
