"use strict";
/**
 * BeatInfo Service
 *
 * Provides real-time beat information from Denon DJ devices including:
 * - Current beat position
 * - Total beats in track
 * - BPM (beats per minute)
 * - Sample position
 *
 * Ported from honusz (via chrisle/StageLinq main branch)
 * https://github.com/chrisle/StageLinq
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BeatInfo = void 0;
const WriteContext_1 = require("../utils/WriteContext");
const Service_1 = require("./Service");
class BeatInfo extends Service_1.Service {
    constructor(address, port, controller) {
        super(address, port, controller);
        this.currentBeatData = null;
        this.options = { everyNBeats: 0 };
    }
    /**
     * Initialize the BeatInfo service by subscribing to beat data
     */
    async init() {
        await this.subscribeToBeatInfo();
    }
    /**
     * Configure beat info options
     */
    setOptions(options) {
        this.options = { ...this.options, ...options };
    }
    /**
     * Get the current beat data
     */
    getBeatData() {
        return this.currentBeatData;
    }
    /**
     * Send subscription request to receive beat info
     */
    async subscribeToBeatInfo() {
        const ctx = new WriteContext_1.WriteContext();
        // BeatInfo subscription message: 8 bytes of zeros
        ctx.write(new Uint8Array([0x0, 0x0, 0x0, 0x4, 0x0, 0x0, 0x0, 0x0]));
        await this.write(ctx);
    }
    /**
     * Parse incoming beat data
     */
    parseData(ctx) {
        // BeatInfo messages are at least 72 bytes
        // Format: id (4) + clock (8) + deckCount (4) + deckData (deckCount * 24) + samples (deckCount * 8)
        if (ctx.sizeLeft() < 20) {
            return null;
        }
        const id = ctx.readUInt32();
        const clock = ctx.readUInt64();
        const deckCount = ctx.readUInt32();
        const decks = [];
        // Read beat data for each deck
        for (let i = 0; i < deckCount; i++) {
            decks.push({
                beat: ctx.readFloat64(),
                totalBeats: ctx.readFloat64(),
                bpm: ctx.readFloat64(),
            });
        }
        // Read sample positions for each deck
        for (let i = 0; i < deckCount; i++) {
            if (ctx.sizeLeft() >= 8) {
                decks[i].samples = ctx.readFloat64();
            }
        }
        const message = {
            id,
            message: {
                clock,
                deckCount,
                decks,
            },
        };
        return message;
    }
    /**
     * Handle parsed beat messages
     */
    messageHandler(data) {
        if (!data?.message) {
            return;
        }
        const shouldEmit = this.shouldEmitBeat(data.message);
        this.currentBeatData = data.message;
        if (shouldEmit) {
            this.emit('beatMessage', data.message);
        }
    }
    /**
     * Determine if we should emit a beat event based on options
     */
    shouldEmitBeat(newData) {
        const everyN = this.options.everyNBeats || 0;
        // Always emit if no filtering
        if (everyN === 0) {
            return true;
        }
        // First beat data, always emit
        if (!this.currentBeatData) {
            return true;
        }
        // Check if any deck crossed a beat boundary
        for (let i = 0; i < newData.deckCount; i++) {
            const prevBeat = this.currentBeatData.decks[i]?.beat || 0;
            const currentBeat = newData.decks[i].beat;
            const prevBeatN = Math.floor(prevBeat / everyN);
            const currentBeatN = Math.floor(currentBeat / everyN);
            if (prevBeatN !== currentBeatN) {
                return true;
            }
        }
        return false;
    }
}
exports.BeatInfo = BeatInfo;
//# sourceMappingURL=BeatInfo.js.map