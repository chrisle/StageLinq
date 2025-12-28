"use strict";
/**
 * Network Announcement Module
 *
 * Handles UDP broadcast announcements for StageLinq device discovery.
 * Includes platform-specific handling for Windows broadcast requirements.
 *
 * Windows broadcast fix ported from go-stagelinq (icedream)
 * https://github.com/icedream/go-stagelinq
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDiscoveryMessage = exports.announce = exports.unannounce = void 0;
const types_1 = require("../types");
const dgram_1 = require("dgram");
const LogEmitter_1 = require("../LogEmitter");
const os_1 = require("os");
const assert_1 = require("assert");
const ip_1 = require("ip");
const WriteContext_1 = require("../utils/WriteContext");
/**
 * Find all broadcast targets for network interfaces.
 * Returns both broadcast IPs and local IPs for Windows compatibility.
 *
 * On Windows, we need to bind to each interface and broadcast separately
 * because Windows doesn't route broadcasts across interfaces correctly.
 *
 * @returns Array of broadcast targets
 */
function findBroadcastTargets() {
    const interfaces = Object.values((0, os_1.networkInterfaces)());
    const targets = [];
    for (const i of interfaces) {
        if (!i || !i.length)
            continue;
        for (const entry of i) {
            if (entry.family === 'IPv4' && entry.internal === false) {
                const info = (0, ip_1.subnet)(entry.address, entry.netmask);
                targets.push({
                    broadcastIP: info.broadcastAddress,
                    localIP: entry.address,
                });
            }
        }
    }
    return targets;
}
/** Single socket for non-Windows platforms */
let announceClient = null;
/** Per-interface sockets for Windows */
let windowsSockets = new Map();
let announceTimer = null;
/** Check if running on Windows */
const isWindows = (0, os_1.platform)() === 'win32';
function writeDiscoveryMessage(p_ctx, p_message) {
    let written = 0;
    written += p_ctx.writeFixedSizedString(types_1.DISCOVERY_MESSAGE_MARKER);
    written += p_ctx.write(p_message.token);
    written += p_ctx.writeNetworkStringUTF16(p_message.source);
    written += p_ctx.writeNetworkStringUTF16(p_message.action);
    written += p_ctx.writeNetworkStringUTF16(p_message.software.name);
    written += p_ctx.writeNetworkStringUTF16(p_message.software.version);
    written += p_ctx.writeUInt16(p_message.port);
    return written;
}
/**
 * Initialize a UDP socket for broadcasting.
 * On non-Windows platforms, creates a single socket.
 *
 * @param localIP Optional local IP to bind to (used on Windows)
 */
async function initUdpSocket(localIP) {
    return new Promise((resolve, reject) => {
        try {
            const client = (0, dgram_1.createSocket)({ type: 'udp4', reuseAddr: true });
            client.on('error', (err) => {
                LogEmitter_1.Logger.error(`UDP socket error: ${err}`);
                reject(err);
            });
            client.on('listening', () => {
                client.setBroadcast(true);
                resolve(client);
            });
            // On Windows, bind to specific interface; otherwise bind to any
            if (localIP) {
                client.bind(0, localIP);
            }
            else {
                client.bind();
            }
        }
        catch (err) {
            LogEmitter_1.Logger.error(`Failed to create UDP socket for announcing: ${err}`);
            reject(err);
        }
    });
}
/**
 * Initialize sockets for Windows - one per network interface.
 * This is required because Windows doesn't properly route broadcasts
 * across interfaces when using a single socket.
 *
 * Ported from go-stagelinq (icedream)
 */
async function initWindowsSockets() {
    const targets = findBroadcastTargets();
    for (const target of targets) {
        if (!windowsSockets.has(target.localIP)) {
            try {
                const socket = await initUdpSocket(target.localIP);
                windowsSockets.set(target.localIP, socket);
                LogEmitter_1.Logger.debug(`Created broadcast socket for interface ${target.localIP}`);
            }
            catch (err) {
                LogEmitter_1.Logger.warn(`Failed to create socket for interface ${target.localIP}: ${err}`);
            }
        }
    }
}
/**
 * Close all Windows sockets
 */
function closeWindowsSockets() {
    for (const [ip, socket] of windowsSockets.entries()) {
        try {
            socket.close();
        }
        catch (err) {
            LogEmitter_1.Logger.warn(`Error closing socket for ${ip}: ${err}`);
        }
    }
    windowsSockets.clear();
}
/**
 * Broadcast a message to all network interfaces.
 *
 * On Windows, uses per-interface sockets to ensure broadcasts
 * reach all network segments.
 *
 * On other platforms, uses a single socket with broadcast enabled.
 */
async function broadcastMessage(p_message) {
    const targets = findBroadcastTargets();
    (0, assert_1.strict)(targets.length > 0, 'No broadcast targets have been found');
    if (isWindows) {
        // Windows: send from each interface's socket to its broadcast address
        const promises = targets.map(async (target) => {
            const socket = windowsSockets.get(target.localIP);
            if (!socket) {
                LogEmitter_1.Logger.warn(`No socket available for interface ${target.localIP}`);
                return;
            }
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Failed to send announcement to ${target.broadcastIP}`));
                }, types_1.CONNECT_TIMEOUT);
                socket.send(p_message, types_1.LISTEN_PORT, target.broadcastIP, (err) => {
                    clearTimeout(timeout);
                    if (err) {
                        LogEmitter_1.Logger.warn(`Failed to send to ${target.broadcastIP}: ${err}`);
                        resolve(); // Don't reject, just log and continue
                    }
                    else {
                        resolve();
                    }
                });
            });
        });
        await Promise.all(promises);
    }
    else {
        // Non-Windows: use single socket for all broadcasts
        const send = async function (broadcastIP) {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Failed to send announcement'));
                }, types_1.CONNECT_TIMEOUT);
                announceClient.send(p_message, types_1.LISTEN_PORT, broadcastIP, (err) => {
                    clearTimeout(timeout);
                    if (err) {
                        LogEmitter_1.Logger.warn(`Failed to send to ${broadcastIP}: ${err}`);
                        resolve();
                    }
                    else {
                        resolve();
                    }
                });
            });
        };
        const promises = targets.map((target) => send(target.broadcastIP));
        await Promise.all(promises);
    }
}
/**
 * Stop announcing and send logout message
 */
async function unannounce(message) {
    if (!announceTimer) {
        LogEmitter_1.Logger.warn('Announce timer has not started.');
        return;
    }
    (0, assert_1.strict)(announceTimer);
    clearInterval(announceTimer);
    announceTimer = null;
    const ctx = new WriteContext_1.WriteContext();
    writeDiscoveryMessage(ctx, message);
    const msg = new Uint8Array(ctx.getBuffer());
    await broadcastMessage(msg);
    // Clean up sockets
    if (isWindows) {
        closeWindowsSockets();
    }
    else if (announceClient) {
        announceClient.close();
        announceClient = null;
    }
    LogEmitter_1.Logger.info("Unannounced myself");
}
exports.unannounce = unannounce;
/**
 * Start announcing presence on the StageLinq network
 */
async function announce(message) {
    if (announceTimer) {
        LogEmitter_1.Logger.log('Already has an announce timer.');
        return;
    }
    // Initialize sockets based on platform
    if (isWindows) {
        await initWindowsSockets();
    }
    else {
        if (!announceClient) {
            announceClient = await initUdpSocket();
        }
    }
    const ctx = new WriteContext_1.WriteContext();
    writeDiscoveryMessage(ctx, message);
    const msg = new Uint8Array(ctx.getBuffer());
    // Immediately announce myself
    await broadcastMessage(msg);
    announceTimer = setInterval(broadcastMessage, types_1.ANNOUNCEMENT_INTERVAL, msg);
    LogEmitter_1.Logger.info("Announced myself");
}
exports.announce = announce;
;
function createDiscoveryMessage(action, discoveryMessageOptions) {
    const msg = {
        action: action,
        port: 0,
        software: {
            name: discoveryMessageOptions.name,
            version: discoveryMessageOptions.version
        },
        source: discoveryMessageOptions.source,
        token: discoveryMessageOptions.token
    };
    return msg;
}
exports.createDiscoveryMessage = createDiscoveryMessage;
//# sourceMappingURL=announce.js.map