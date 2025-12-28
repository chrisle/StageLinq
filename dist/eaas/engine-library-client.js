"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineLibraryClient = void 0;
const events_1 = require("events");
const LogEmitter_1 = require("../LogEmitter");
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
class EngineLibraryClient extends events_1.EventEmitter {
    // private grpcClient: any = null; // Placeholder for actual gRPC client
    constructor(device, options = {}) {
        super();
        this.connected = false;
        this.device = device;
        this._options = {
            timeout: options.timeout ?? 10000,
        };
    }
    /**
     * Get the client options.
     */
    get options() {
        return this._options;
    }
    /**
     * Get the device this client is connected to.
     */
    getDevice() {
        return this.device;
    }
    /**
     * Check if client is connected.
     */
    isConnected() {
        return this.connected;
    }
    /**
     * Connect to the device's gRPC service.
     *
     * @throws Error if gRPC is not available (placeholder implementation)
     */
    async connect() {
        if (this.connected) {
            LogEmitter_1.Logger.warn('EAAS: Already connected');
            return;
        }
        const endpoint = `${this.device.address}:${this.device.grpcPort}`;
        LogEmitter_1.Logger.info(`EAAS: Connecting to ${endpoint}`);
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
        throw new Error('gRPC not implemented. Install @grpc/grpc-js and generate proto bindings. ' +
            'See eaas/README.md for setup instructions.');
    }
    /**
     * Disconnect from the device.
     */
    async disconnect() {
        if (!this.connected) {
            return;
        }
        // TODO: Close gRPC client
        // this.grpcClient?.close();
        // this.grpcClient = null;
        this.connected = false;
        this.emit('disconnected');
        LogEmitter_1.Logger.info('EAAS: Disconnected');
    }
    /**
     * Get all available music libraries.
     */
    async getLibraries(_request = {}) {
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
    async getLibrary(_request) {
        this.ensureConnected();
        throw new Error('gRPC not implemented');
    }
    /**
     * Get tracks from a library or playlist.
     */
    async getTracks(_request) {
        this.ensureConnected();
        throw new Error('gRPC not implemented');
    }
    /**
     * Get detailed information about a specific track.
     */
    async getTrack(_request) {
        this.ensureConnected();
        throw new Error('gRPC not implemented');
    }
    /**
     * Search for tracks in a library.
     */
    async searchTracks(_request) {
        this.ensureConnected();
        throw new Error('gRPC not implemented');
    }
    /**
     * Get available filter options for a library/playlist.
     */
    async getSearchFilters(_request) {
        this.ensureConnected();
        throw new Error('gRPC not implemented');
    }
    /**
     * Get history sessions.
     */
    async getHistorySessions(_request) {
        this.ensureConnected();
        throw new Error('gRPC not implemented');
    }
    /**
     * Get played tracks from history.
     */
    async getHistoryPlayedTracks(_request) {
        this.ensureConnected();
        throw new Error('gRPC not implemented');
    }
    /**
     * Subscribe to library events.
     * Events are emitted via the 'libraryEvent' event.
     */
    async subscribeToEvents(_request = {}) {
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
    ensureConnected() {
        if (!this.connected) {
            throw new Error('Not connected. Call connect() first.');
        }
    }
}
exports.EngineLibraryClient = EngineLibraryClient;
//# sourceMappingURL=engine-library-client.js.map