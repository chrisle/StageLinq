"use strict";
/**
 * TimeSynchronization Service
 *
 * Synchronizes timing between the client and Denon DJ devices.
 * Used for accurate beat-synced operations.
 *
 * Ported from honusz (via chrisle/StageLinq main branch)
 * https://github.com/chrisle/StageLinq
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeSync = void 0;
const WriteContext_1 = require("../utils/WriteContext");
const Service_1 = require("./Service");
const LogEmitter_1 = require("../LogEmitter");
const perf_hooks_1 = require("perf_hooks");
class TimeSync extends Service_1.Service {
    constructor(address, port, controller) {
        super(address, port, controller);
        this.localTime = 0n;
        this.remoteTime = 0n;
        this.avgTimeArray = [];
    }
    /**
     * Initialize the TimeSync service
     */
    async init() {
        // TimeSync doesn't need initialization, it responds to device requests
    }
    /**
     * Get current timestamp in milliseconds
     */
    getTimestamp() {
        return BigInt(Math.floor(perf_hooks_1.performance.now()));
    }
    /**
     * Send a time sync query
     */
    async sendTimeSyncQuery() {
        this.localTime = this.getTimestamp();
        const msg = this.createTimeSyncMessage(1, [this.localTime]);
        const ctx = new WriteContext_1.WriteContext();
        ctx.write(msg);
        await this.write(ctx);
    }
    /**
     * Create a time sync message
     */
    createTimeSyncMessage(msgId, timestamps) {
        const innerCtx = new WriteContext_1.WriteContext();
        innerCtx.writeUInt32(msgId);
        for (const ts of timestamps) {
            innerCtx.writeUInt64(ts);
        }
        const message = innerCtx.getBuffer();
        const ctx = new WriteContext_1.WriteContext();
        ctx.writeUInt32(message.length);
        ctx.write(message);
        return ctx.getBuffer();
    }
    /**
     * Parse incoming time sync data
     */
    parseData(ctx) {
        const localTimestamp = this.getTimestamp();
        const size = ctx.readUInt32();
        if (size === 0) {
            // Service announcement - skip for now
            return null;
        }
        const id = ctx.readUInt32();
        const timestamps = [];
        while (ctx.sizeLeft() >= 8) {
            timestamps.push(ctx.readUInt64());
        }
        return {
            id,
            message: {
                timestamps,
                localTimestamp,
            },
        };
    }
    /**
     * Handle parsed time sync messages
     */
    messageHandler(msg) {
        if (!msg?.message) {
            return;
        }
        switch (msg.id) {
            case 1:
                // Time sync query from device
                this.remoteTime = msg.message.timestamps[0] || 0n;
                this.sendTimeSyncQuery();
                break;
            case 2:
                // Time sync reply from device
                if (msg.message.timestamps.length >= 2) {
                    const remoteClock = msg.message.timestamps[1] - this.remoteTime;
                    this.updateTimeAverage(remoteClock);
                }
                break;
            default:
                LogEmitter_1.Logger.debug(`TimeSync: Unknown message id ${msg.id}`);
                break;
        }
    }
    /**
     * Update the running average of time differences
     */
    updateTimeAverage(time) {
        const MAX_SAMPLES = 100;
        if (this.avgTimeArray.length >= MAX_SAMPLES) {
            this.avgTimeArray.shift();
        }
        this.avgTimeArray.push(time);
        if (this.avgTimeArray.length >= MAX_SAMPLES) {
            const sum = this.avgTimeArray.reduce((a, b) => a + b, 0n);
            const avg = sum / BigInt(this.avgTimeArray.length);
            LogEmitter_1.Logger.silly(`TimeSync: Average time offset ${avg}ms`);
        }
    }
    /**
     * Get the current average time offset
     */
    getAverageOffset() {
        if (this.avgTimeArray.length === 0) {
            return null;
        }
        const sum = this.avgTimeArray.reduce((a, b) => a + b, 0n);
        return sum / BigInt(this.avgTimeArray.length);
    }
}
exports.TimeSync = TimeSync;
//# sourceMappingURL=TimeSync.js.map