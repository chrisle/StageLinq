"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDiscoveryMessage = exports.announce = exports.unannounce = void 0;
const types_1 = require("../types");
const dgram_1 = require("dgram");
const LogEmitter_1 = require("../LogEmitter");
const os_1 = require("os");
const assert_1 = require("assert");
const ip_1 = require("ip");
const WriteContext_1 = require("../utils/WriteContext");
function findBroadcastIPs() {
    const interfaces = Object.values((0, os_1.networkInterfaces)());
    (0, assert_1.strict)(interfaces.length);
    const ips = [];
    for (const i of interfaces) {
        (0, assert_1.strict)(i && i.length);
        for (const entry of i) {
            if (entry.family === 'IPv4' && entry.internal === false) {
                const info = (0, ip_1.subnet)(entry.address, entry.netmask);
                ips.push(info.broadcastAddress);
            }
        }
    }
    return ips;
}
let announceClient = null;
let announceTimer = null;
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
async function initUdpSocket() {
    return new Promise((resolve, reject) => {
        try {
            const client = (0, dgram_1.createSocket)({ type: 'udp4', reuseAddr: true });
            client.bind(); // we need to bind to a random port in order to enable broadcasting
            client.on('listening', () => {
                client.setBroadcast(true); // needs to be true in order to UDP multicast on MacOS
                resolve(client);
            });
        }
        catch (err) {
            LogEmitter_1.Logger.error(`Failed to create UDP socket for announcing: ${err}`);
            reject(err);
        }
    });
}
async function broadcastMessage(p_message) {
    const ips = findBroadcastIPs();
    (0, assert_1.strict)(ips.length > 0, 'No broadcast IPs have been found');
    const send = async function (p_ip) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                reject(new Error('Failed to send announcement'));
            }, types_1.CONNECT_TIMEOUT);
            announceClient.send(p_message, types_1.LISTEN_PORT, p_ip, () => {
                // Logger.log('UDP message sent to ' + p_ip);
                resolve();
            });
        });
    };
    const promises = ips.map((ip) => send(ip));
    await Promise.all(promises);
}
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
    // Logger.info("Unannounced myself");
}
exports.unannounce = unannounce;
async function announce(message) {
    if (announceTimer) {
        LogEmitter_1.Logger.log('Already has an announce timer.');
        return;
    }
    if (!announceClient)
        announceClient = await initUdpSocket();
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