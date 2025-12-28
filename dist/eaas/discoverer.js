"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EAASDiscoverer = void 0;
const dgram_1 = require("dgram");
const events_1 = require("events");
const os_1 = require("os");
const ip_1 = require("ip");
const LogEmitter_1 = require("../LogEmitter");
const types_1 = require("./types");
const messages_1 = require("./messages");
const DEFAULT_TIMEOUT = 5000;
const DEFAULT_SCAN_INTERVAL = 10000;
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
class EAASDiscoverer extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.socket = null;
        this.scanTimer = null;
        this.discoveredDevices = new Map();
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
    async discover() {
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
    async startScanning() {
        if (this.scanTimer) {
            LogEmitter_1.Logger.warn('EAAS: Already scanning');
            return;
        }
        await this.initSocket();
        // Initial broadcast
        await this.broadcast();
        // Schedule periodic broadcasts
        this.scanTimer = setInterval(async () => {
            try {
                await this.broadcast();
            }
            catch (err) {
                this.emit('error', err);
            }
        }, this.options.scanInterval);
        LogEmitter_1.Logger.info('EAAS: Started scanning for devices');
    }
    /**
     * Stop continuous scanning.
     */
    stopScanning() {
        if (this.scanTimer) {
            clearInterval(this.scanTimer);
            this.scanTimer = null;
        }
        this.closeSocket();
        LogEmitter_1.Logger.info('EAAS: Stopped scanning for devices');
    }
    /**
     * Get all discovered devices.
     */
    getDevices() {
        return Array.from(this.discoveredDevices.values());
    }
    /**
     * Initialize the UDP socket for discovery.
     */
    async initSocket() {
        if (this.socket) {
            return;
        }
        return new Promise((resolve, reject) => {
            try {
                this.socket = (0, dgram_1.createSocket)({ type: 'udp4', reuseAddr: true });
                this.socket.on('error', (err) => {
                    LogEmitter_1.Logger.error(`EAAS discovery socket error: ${err}`);
                    this.emit('error', err);
                });
                this.socket.on('message', (msg, rinfo) => {
                    this.handleMessage(new Uint8Array(msg), rinfo.address);
                });
                this.socket.on('listening', () => {
                    this.socket.setBroadcast(true);
                    resolve();
                });
                this.socket.bind();
            }
            catch (err) {
                reject(err);
            }
        });
    }
    /**
     * Close the UDP socket.
     */
    closeSocket() {
        if (this.socket) {
            try {
                this.socket.close();
            }
            catch (err) {
                LogEmitter_1.Logger.warn(`EAAS: Error closing socket: ${err}`);
            }
            this.socket = null;
        }
    }
    /**
     * Broadcast discovery request to all network interfaces.
     */
    async broadcast() {
        const request = (0, messages_1.createDiscoveryRequest)();
        const targets = this.getBroadcastTargets();
        if (targets.length === 0) {
            LogEmitter_1.Logger.warn('EAAS: No broadcast targets found');
            return;
        }
        const promises = targets.map((target) => this.sendTo(request, target));
        await Promise.all(promises);
        LogEmitter_1.Logger.debug(`EAAS: Broadcast discovery request to ${targets.length} interfaces`);
    }
    /**
     * Send data to a specific broadcast address.
     */
    sendTo(data, address) {
        return new Promise((resolve) => {
            if (!this.socket) {
                resolve();
                return;
            }
            this.socket.send(data, types_1.EAAS_DISCOVERY_PORT, address, (err) => {
                if (err) {
                    LogEmitter_1.Logger.warn(`EAAS: Failed to send to ${address}: ${err}`);
                }
                resolve();
            });
        });
    }
    /**
     * Handle incoming discovery response.
     */
    handleMessage(data, remoteAddress) {
        const device = (0, messages_1.parseDiscoveryResponse)(data, remoteAddress);
        if (!device) {
            return; // Not a valid EAAS response
        }
        // Use address as key to track unique devices
        const key = `${device.address}:${device.grpcPort}`;
        if (!this.discoveredDevices.has(key)) {
            this.discoveredDevices.set(key, device);
            LogEmitter_1.Logger.info(`EAAS: Discovered device: ${device.hostname} at ${device.address}:${device.grpcPort}`);
            this.emit('discovered', device);
        }
    }
    /**
     * Get broadcast addresses for all network interfaces.
     */
    getBroadcastTargets() {
        const interfaces = Object.values((0, os_1.networkInterfaces)());
        const targets = [];
        for (const iface of interfaces) {
            if (!iface)
                continue;
            for (const entry of iface) {
                if (entry.family === 'IPv4' && !entry.internal) {
                    try {
                        const info = (0, ip_1.subnet)(entry.address, entry.netmask);
                        targets.push(info.broadcastAddress);
                    }
                    catch (err) {
                        LogEmitter_1.Logger.warn(`EAAS: Failed to get broadcast for ${entry.address}: ${err}`);
                    }
                }
            }
        }
        return targets;
    }
}
exports.EAASDiscoverer = EAASDiscoverer;
//# sourceMappingURL=discoverer.js.map