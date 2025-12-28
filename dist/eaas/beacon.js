"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EAASBeacon = void 0;
const dgram_1 = require("dgram");
const events_1 = require("events");
const os_1 = require("os");
const LogEmitter_1 = require("../LogEmitter");
const token_1 = require("../utils/token");
const types_1 = require("./types");
const messages_1 = require("./messages");
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
class EAASBeacon extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.socket = null;
        // Generate token if not provided
        const token = options.token ?? (0, token_1.generateToken)();
        this.options = {
            name: options.name,
            softwareVersion: options.softwareVersion,
            token,
            grpcHost: options.grpcHost ?? '',
            grpcPort: options.grpcPort ?? types_1.EAAS_GRPC_PORT,
        };
        // Pre-build response message (will be updated with correct host when bound)
        this.responseMessage = new Uint8Array(0);
    }
    /**
     * Get the beacon's token.
     */
    get token() {
        return this.options.token;
    }
    /**
     * Get the gRPC port.
     */
    get grpcPort() {
        return this.options.grpcPort;
    }
    /**
     * Get the HTTP port (gRPC port + 10).
     */
    get httpPort() {
        return this.options.grpcPort + 10;
    }
    /**
     * Start the beacon.
     */
    async start() {
        if (this.socket) {
            LogEmitter_1.Logger.warn('EAAS Beacon: Already started');
            return;
        }
        return new Promise((resolve, reject) => {
            try {
                this.socket = (0, dgram_1.createSocket)({ type: 'udp4', reuseAddr: true });
                this.socket.on('error', (err) => {
                    LogEmitter_1.Logger.error(`EAAS Beacon socket error: ${err}`);
                    this.emit('error', err);
                });
                this.socket.on('message', (msg, rinfo) => {
                    this.handleMessage(new Uint8Array(msg), rinfo);
                });
                this.socket.on('listening', () => {
                    const addr = this.socket.address();
                    LogEmitter_1.Logger.info(`EAAS Beacon: Listening on ${addr.address}:${addr.port}`);
                    // Build response message with correct host
                    const host = this.options.grpcHost || this.getLocalIP();
                    const url = `${host}:${this.options.grpcPort}`;
                    this.responseMessage = (0, messages_1.createDiscoveryResponse)(this.options.token, this.options.name, url, this.options.softwareVersion);
                    resolve();
                });
                // Bind to discovery port
                this.socket.bind(types_1.EAAS_DISCOVERY_PORT);
            }
            catch (err) {
                reject(err);
            }
        });
    }
    /**
     * Stop the beacon.
     */
    stop() {
        if (this.socket) {
            try {
                this.socket.close();
            }
            catch (err) {
                LogEmitter_1.Logger.warn(`EAAS Beacon: Error closing socket: ${err}`);
            }
            this.socket = null;
            LogEmitter_1.Logger.info('EAAS Beacon: Stopped');
        }
    }
    /**
     * Handle incoming discovery request.
     */
    handleMessage(data, rinfo) {
        if (!(0, messages_1.isDiscoveryRequest)(data)) {
            return; // Not a discovery request
        }
        LogEmitter_1.Logger.debug(`EAAS Beacon: Discovery request from ${rinfo.address}:${rinfo.port}`);
        this.emit('request', rinfo.address, rinfo.port);
        // Send response
        this.socket?.send(this.responseMessage, rinfo.port, rinfo.address, (err) => {
            if (err) {
                LogEmitter_1.Logger.warn(`EAAS Beacon: Failed to send response to ${rinfo.address}: ${err}`);
            }
        });
    }
    /**
     * Get local IP address for announcement.
     */
    getLocalIP() {
        const interfaces = Object.values((0, os_1.networkInterfaces)());
        for (const iface of interfaces) {
            if (!iface)
                continue;
            for (const entry of iface) {
                if (entry.family === 'IPv4' && !entry.internal) {
                    return entry.address;
                }
            }
        }
        return '127.0.0.1';
    }
}
exports.EAASBeacon = EAASBeacon;
//# sourceMappingURL=beacon.js.map