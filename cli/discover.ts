#!/usr/bin/env node
/**
 * StageLinq Discovery CLI Tool
 *
 * Discovers StageLinq and EAAS devices on the local network.
 *
 * Usage: npx ts-node cli/discover.ts [--timeout=5000] [--eaas]
 */

import { StageLinqListener } from '../network';
import { EAAS, formatToken } from '../';
import { ConnectionInfo } from '../types';

require('console-stamp')(console, {
  format: ':date(HH:MM:ss) :label',
});

interface DiscoverOptions {
  timeout: number;
  includeEAAS: boolean;
}

function parseArgs(): DiscoverOptions {
  const args = process.argv.slice(2);
  let timeout = 5000;
  let includeEAAS = false;

  for (const arg of args) {
    if (arg.startsWith('--timeout=')) {
      timeout = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--eaas') {
      includeEAAS = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npx ts-node cli/discover.ts [options]');
      console.log('');
      console.log('Options:');
      console.log('  --timeout=<ms>  Discovery timeout in milliseconds (default: 5000)');
      console.log('  --eaas          Also discover EAAS devices');
      console.log('  --help, -h      Show this help message');
      process.exit(0);
    }
  }

  return { timeout, includeEAAS };
}

async function discoverStageLinq(timeout: number): Promise<ConnectionInfo[]> {
  const devices: ConnectionInfo[] = [];
  const seen = new Set<string>();

  return new Promise((resolve) => {
    const listener = new StageLinqListener();

    listener.listenForDevices((info) => {
      const key = `${info.address}:${info.port}`;
      if (!seen.has(key)) {
        seen.add(key);
        devices.push(info);

        console.log('');
        console.log(`StageLinq Device Found:`);
        console.log(`  Name:     ${info.software.name}`);
        console.log(`  Version:  ${info.software.version}`);
        console.log(`  Address:  ${info.address}:${info.port}`);
        console.log(`  Source:   ${info.source}`);
        console.log(`  Token:    ${formatToken(info.token)}`);
        console.log(`  Action:   ${info.action}`);
      }
    });

    setTimeout(() => {
      resolve(devices);
    }, timeout);
  });
}

async function discoverEAAS(timeout: number): Promise<void> {
  const discoverer = new EAAS.EAASDiscoverer({ timeout });

  discoverer.on('discovered', (device: EAAS.EAASDevice) => {
    console.log('');
    console.log(`EAAS Device Found:`);
    console.log(`  Hostname: ${device.hostname}`);
    console.log(`  Version:  ${device.softwareVersion}`);
    console.log(`  Address:  ${device.address}`);
    console.log(`  gRPC:     ${device.address}:${device.grpcPort}`);
    console.log(`  HTTP:     ${device.address}:${device.httpPort}`);
    console.log(`  Token:    ${formatToken(device.token)}`);
  });

  await discoverer.discover();
}

async function main() {
  const options = parseArgs();

  console.log(`Discovering devices (timeout: ${options.timeout}ms)...`);
  console.log('');

  const promises: Promise<any>[] = [
    discoverStageLinq(options.timeout),
  ];

  if (options.includeEAAS) {
    promises.push(discoverEAAS(options.timeout));
  }

  await Promise.all(promises);

  console.log('');
  console.log('Discovery complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
