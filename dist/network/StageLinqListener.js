"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageLinqListener = void 0;
const dgram_1 = require("dgram");
const common_1 = require("../types/common");
const ReadContext_1 = require("../utils/ReadContext");
const assert_1 = require("assert");
/**
 * Continuously listens for devices to announce themselves. When they do,
 * execute a callback.
 */
class StageLinqListener {
    /**
     * Listen for new devices on the network and callback when a new one is found.
     * @param callback Callback when new device is discovered.
     */
    listenForDevices(callback) {
        const client = (0, dgram_1.createSocket)({ type: 'udp4', reuseAddr: true });
        client.on('message', (p_announcement, p_remote) => {
            const ctx = new ReadContext_1.ReadContext(p_announcement.buffer, false);
            const result = this.readConnectionInfo(ctx, p_remote.address);
            (0, assert_1.strict)(ctx.tell() === p_remote.size);
            callback(result);
        });
        client.bind(common_1.LISTEN_PORT);
    }
    readConnectionInfo(p_ctx, p_address) {
        const magic = p_ctx.getString(4);
        if (magic !== common_1.DISCOVERY_MESSAGE_MARKER) {
            return null;
        }
        const result = {
            token: p_ctx.read(16),
            source: p_ctx.readNetworkStringUTF16(),
            action: p_ctx.readNetworkStringUTF16(),
            software: {
                name: p_ctx.readNetworkStringUTF16(),
                version: p_ctx.readNetworkStringUTF16(),
            },
            port: p_ctx.readUInt16(),
            address: p_address,
        };
        (0, assert_1.strict)(p_ctx.isEOF());
        return result;
    }
}
exports.StageLinqListener = StageLinqListener;
//# sourceMappingURL=StageLinqListener.js.map