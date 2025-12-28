/**
 * Network Announcement Module
 *
 * Handles UDP broadcast announcements for StageLinq device discovery.
 * Includes platform-specific handling for Windows broadcast requirements.
 *
 * Windows broadcast fix ported from go-stagelinq (icedream)
 * https://github.com/icedream/go-stagelinq
 */

import {
  ANNOUNCEMENT_INTERVAL,
  CONNECT_TIMEOUT,
  DISCOVERY_MESSAGE_MARKER,
  LISTEN_PORT,
} from '../types';
import { createSocket, Socket as UDPSocket } from 'dgram';
import { Logger } from '../LogEmitter';
import { networkInterfaces, platform } from 'os';
import { strict as assert } from 'assert';
import { subnet } from 'ip';
import { WriteContext } from '../utils/WriteContext';
import type { DiscoveryMessage } from '../types';

/**
 * Interface information for broadcasting
 */
interface BroadcastTarget {
  /** The broadcast IP address */
  broadcastIP: string;
  /** The local interface IP (for binding on Windows) */
  localIP: string;
}

/**
 * Find all broadcast targets for network interfaces.
 * Returns both broadcast IPs and local IPs for Windows compatibility.
 *
 * On Windows, we need to bind to each interface and broadcast separately
 * because Windows doesn't route broadcasts across interfaces correctly.
 *
 * @returns Array of broadcast targets
 */
function findBroadcastTargets(): BroadcastTarget[] {
  const interfaces = Object.values(networkInterfaces());
  const targets: BroadcastTarget[] = [];

  for (const i of interfaces) {
    if (!i || !i.length) continue;
    for (const entry of i) {
      if (entry.family === 'IPv4' && entry.internal === false) {
        const info = subnet(entry.address, entry.netmask);
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
let announceClient: UDPSocket | null = null;

/** Per-interface sockets for Windows */
let windowsSockets: Map<string, UDPSocket> = new Map();

let announceTimer: NodeJS.Timer | null = null;

/** Check if running on Windows */
const isWindows = platform() === 'win32';

function writeDiscoveryMessage(p_ctx: WriteContext, p_message: DiscoveryMessage): number {
  let written = 0;
  written += p_ctx.writeFixedSizedString(DISCOVERY_MESSAGE_MARKER);
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
async function initUdpSocket(localIP?: string): Promise<UDPSocket> {
  return new Promise<UDPSocket>((resolve, reject) => {
    try {
      const client = createSocket({type: 'udp4', reuseAddr: true});

      client.on('error', (err) => {
        Logger.error(`UDP socket error: ${err}`);
        reject(err);
      });

      client.on('listening', () => {
        client.setBroadcast(true);
        resolve(client);
      });

      // On Windows, bind to specific interface; otherwise bind to any
      if (localIP) {
        client.bind(0, localIP);
      } else {
        client.bind();
      }
    } catch (err) {
      Logger.error(`Failed to create UDP socket for announcing: ${err}`);
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
async function initWindowsSockets(): Promise<void> {
  const targets = findBroadcastTargets();

  for (const target of targets) {
    if (!windowsSockets.has(target.localIP)) {
      try {
        const socket = await initUdpSocket(target.localIP);
        windowsSockets.set(target.localIP, socket);
        Logger.debug(`Created broadcast socket for interface ${target.localIP}`);
      } catch (err) {
        Logger.warn(`Failed to create socket for interface ${target.localIP}: ${err}`);
      }
    }
  }
}

/**
 * Close all Windows sockets
 */
function closeWindowsSockets(): void {
  for (const [ip, socket] of windowsSockets.entries()) {
    try {
      socket.close();
    } catch (err) {
      Logger.warn(`Error closing socket for ${ip}: ${err}`);
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
async function broadcastMessage(p_message: Uint8Array): Promise<void> {
  const targets = findBroadcastTargets();
  assert(targets.length > 0, 'No broadcast targets have been found');

  if (isWindows) {
    // Windows: send from each interface's socket to its broadcast address
    const promises = targets.map(async (target) => {
      const socket = windowsSockets.get(target.localIP);
      if (!socket) {
        Logger.warn(`No socket available for interface ${target.localIP}`);
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Failed to send announcement to ${target.broadcastIP}`));
        }, CONNECT_TIMEOUT);

        socket.send(p_message, LISTEN_PORT, target.broadcastIP, (err) => {
          clearTimeout(timeout);
          if (err) {
            Logger.warn(`Failed to send to ${target.broadcastIP}: ${err}`);
            resolve(); // Don't reject, just log and continue
          } else {
            resolve();
          }
        });
      });
    });

    await Promise.all(promises);
  } else {
    // Non-Windows: use single socket for all broadcasts
    const send = async function (broadcastIP: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Failed to send announcement'));
        }, CONNECT_TIMEOUT);

        announceClient.send(p_message, LISTEN_PORT, broadcastIP, (err) => {
          clearTimeout(timeout);
          if (err) {
            Logger.warn(`Failed to send to ${broadcastIP}: ${err}`);
            resolve();
          } else {
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
export async function unannounce(message: DiscoveryMessage): Promise<void> {
  if (!announceTimer) {
    Logger.warn('Announce timer has not started.');
    return;
  }
  assert(announceTimer);
  clearInterval(announceTimer);
  announceTimer = null;

  const ctx = new WriteContext();
  writeDiscoveryMessage(ctx, message);
  const msg = new Uint8Array(ctx.getBuffer());
  await broadcastMessage(msg);

  // Clean up sockets
  if (isWindows) {
    closeWindowsSockets();
  } else if (announceClient) {
    announceClient.close();
    announceClient = null;
  }

  Logger.info("Unannounced myself");
}

/**
 * Start announcing presence on the StageLinq network
 */
export async function announce(message: DiscoveryMessage): Promise<void> {
  if (announceTimer) {
    Logger.log('Already has an announce timer.')
    return;
  }

  // Initialize sockets based on platform
  if (isWindows) {
    await initWindowsSockets();
  } else {
    if (!announceClient) {
      announceClient = await initUdpSocket();
    }
  }

  const ctx = new WriteContext();
  writeDiscoveryMessage(ctx, message);
  const msg = new Uint8Array(ctx.getBuffer());

  // Immediately announce myself
  await broadcastMessage(msg);

  announceTimer = setInterval(broadcastMessage, ANNOUNCEMENT_INTERVAL, msg);
  Logger.info("Announced myself");
}

export interface DiscoveryMessageOptions {
  name: string;
  version: string;
  source: string;
  token: Uint8Array;
};

export function createDiscoveryMessage(action: string, discoveryMessageOptions: DiscoveryMessageOptions) {
  const msg: DiscoveryMessage = {
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
