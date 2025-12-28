#!/usr/bin/env node
"use strict";
/**
 * StageLinq BeatInfo CLI Tool
 *
 * Connects to a StageLinq device and displays real-time beat information.
 *
 * Usage: npx ts-node cli/beatinfo.ts
 *
 * Note: This tool requires a StageLinq-compatible device on the network.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const StageLinq_1 = require("../StageLinq");
const types_1 = require("../types");
const sleep_1 = require("../utils/sleep");
require('console-stamp')(console, {
    format: ':date(HH:MM:ss) :label',
});
async function main() {
    console.log('StageLinq BeatInfo Demo');
    console.log('=======================');
    console.log('');
    console.log('Connecting to StageLinq network...');
    const stageLinq = new StageLinq_1.StageLinqInstance({
        actingAs: types_1.ActingAsDevice.NowPlaying,
        downloadDbSources: false,
        maxRetries: 3,
    });
    // Setup logging
    stageLinq.logger.on('error', (...args) => console.error(...args));
    stageLinq.logger.on('warn', (...args) => console.warn(...args));
    stageLinq.logger.on('info', (...args) => console.info(...args));
    // Track connection
    stageLinq.devices.on('connected', (info) => {
        console.log(`Connected to: ${info.software.name} (${info.address}:${info.port})`);
    });
    stageLinq.devices.on('ready', () => {
        console.log('');
        console.log('Ready! Listening for beat information...');
        console.log('Press Ctrl+C to exit.');
        console.log('');
    });
    // Display now playing info
    stageLinq.devices.on('nowPlaying', (status) => {
        console.log('');
        console.log(`Now Playing on ${status.deck}:`);
        console.log(`  Title:  ${status.title}`);
        console.log(`  Artist: ${status.artist}`);
    });
    // Display state changes (includes beat/BPM info)
    stageLinq.devices.on('stateChanged', (status) => {
        // Only show if we have BPM info
        if (status.currentBpm) {
            const playState = status.playState ? 'playing' : 'paused';
            process.stdout.write(`\r[${status.deck}] BPM: ${status.currentBpm.toFixed(1).padStart(6)} | ` +
                `State: ${playState.padEnd(10)}`);
        }
    });
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n\nShutting down...');
        try {
            await stageLinq.disconnect();
        }
        catch (err) {
            console.error('Error during disconnect:', err);
        }
        process.exit(0);
    });
    // Connect and run
    try {
        await stageLinq.connect();
        // Keep running
        while (true) {
            await (0, sleep_1.sleep)(1000);
        }
    }
    catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=beatinfo.js.map