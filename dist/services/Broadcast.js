"use strict";
/**
 * Broadcast Service
 *
 * Receives broadcast messages from Denon DJ devices.
 * These messages typically contain database UUIDs, track IDs,
 * and session information.
 *
 * Ported from honusz (via chrisle/StageLinq main branch)
 * https://github.com/chrisle/StageLinq
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Broadcast = void 0;
const Service_1 = require("./Service");
class Broadcast extends Service_1.Service {
    constructor(address, port, controller) {
        super(address, port, controller);
    }
    /**
     * Initialize the Broadcast service
     */
    async init() {
        // Broadcast doesn't need initialization, it receives messages
    }
    /**
     * Parse incoming broadcast data
     */
    parseData(ctx) {
        const length = ctx.readUInt32();
        if (length === 0 && ctx.sizeLeft() > 0) {
            // Service announcement message
            ctx.seek(16); // Skip device ID
            const name = ctx.readNetworkStringUTF16();
            const port = ctx.readUInt16();
            return {
                id: 0,
                message: {
                    key: 'serviceAnnouncement',
                    value: {
                        databaseUuid: name,
                        trackId: port,
                    },
                },
            };
        }
        if (length > 0) {
            // JSON message
            const jsonStr = ctx.getString(length);
            return {
                id: length,
                message: {
                    json: jsonStr,
                },
            };
        }
        return null;
    }
    /**
     * Handle parsed broadcast messages
     */
    messageHandler(data) {
        if (!data?.message) {
            return;
        }
        if (data.message.json) {
            try {
                // Parse the JSON and clean up any dots in keys
                const cleanJson = data.message.json.replace(/\./g, '');
                const parsed = JSON.parse(cleanJson);
                const key = Object.keys(parsed)[0];
                const value = Object.values(parsed)[0];
                this.emit('broadcastMessage', {
                    key,
                    value,
                });
                // Also emit by database UUID for specific listeners
                if (value?.databaseUuid) {
                    this.emit(`db:${value.databaseUuid}`, { key, value });
                }
            }
            catch (e) {
                // Invalid JSON, ignore
            }
        }
    }
}
exports.Broadcast = Broadcast;
//# sourceMappingURL=Broadcast.js.map