"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.announce = exports.unannounce = void 0;
const assert_1 = require("assert");
const common_1 = require("../types/common");
const dgram_1 = require("dgram");
const ip_1 = require("ip");
const os_1 = require("os");
const WriteContext_1 = require("../utils/WriteContext");
const LogEmitter_1 = require("../LogEmitter");
function findBroadcastIPs() {
    const interfaces = Object.values((0, os_1.networkInterfaces)());
    const ips = [];
    for (const i of interfaces) {
        for (const entry of i) {
            if (entry.family === 'IPv4' && entry.internal === false) {
                const info = (0, ip_1.subnet)(entry.address, entry.netmask);
                ips.push(info.broadcastAddress);
            }
        }
    }
    return ips;
}
const announcementMessage = {
    action: common_1.Action.Login,
    port: 0,
    software: {
        name: 'Now Playing',
        version: '2.1.3',
    },
    source: 'nowplaying',
    token: common_1.CLIENT_TOKEN,
};
let announceClient = null;
let announceTimer = null;
function writeDiscoveryMessage(p_ctx, p_message) {
    let written = 0;
    written += p_ctx.writeFixedSizedString(common_1.DISCOVERY_MESSAGE_MARKER);
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
            const client = (0, dgram_1.createSocket)('udp4');
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
            }, common_1.CONNECT_TIMEOUT);
            announceClient.send(p_message, common_1.LISTEN_PORT, p_ip, () => {
                // Logger.log('UDP message sent to ' + p_ip);
                resolve();
            });
        });
    };
    const promises = ips.map((ip) => send(ip));
    await Promise.all(promises);
}
async function unannounce() {
    (0, assert_1.strict)(announceTimer);
    clearInterval(announceTimer);
    announceTimer = null;
    announcementMessage.action = common_1.Action.Logout;
    const ctx = new WriteContext_1.WriteContext();
    writeDiscoveryMessage(ctx, announcementMessage);
    const msg = new Uint8Array(ctx.getBuffer());
    await broadcastMessage(msg);
    // Logger.info("Unannounced myself");
}
exports.unannounce = unannounce;
async function announce() {
    if (announceTimer) {
        LogEmitter_1.Logger.log('Already has an announce timer.');
        return;
    }
    if (!announceClient)
        announceClient = await initUdpSocket();
    announcementMessage.action = common_1.Action.Login;
    const ctx = new WriteContext_1.WriteContext();
    writeDiscoveryMessage(ctx, announcementMessage);
    const msg = new Uint8Array(ctx.getBuffer());
    // Immediately announce myself
    await broadcastMessage(msg);
    announceTimer = setInterval(broadcastMessage, common_1.ANNOUNCEMENT_INTERVAL, msg);
    LogEmitter_1.Logger.info("Announced myself");
}
exports.announce = announce;
//# sourceMappingURL=announce.js.map