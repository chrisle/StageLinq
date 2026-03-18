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
import type { Logger } from '../types/logger';
import { noopLogger } from '../types/logger';
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
        // Skip link-local addresses (169.254.x.x) — these are auto-configured
        // interfaces that rarely host StageLinq devices
        if (entry.address.startsWith('169.254.')) continue;

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

let announceTimer: ReturnType<typeof setInterval> | null = null;

/** Check if running on Windows */
const isWindows = platform() === 'win32';

/** Module-level logger, set by announce/unannounce */
let moduleLogger: Logger = noopLogger;

/** Track targets that have already warned about send failures */
const warnedTargets: Set<string> = new Set();

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
        moduleLogger.error(`UDP socket error: ${err}`);
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
      moduleLogger.error(`Failed to create UDP socket for announcing: ${err}`);
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
        moduleLogger.debug(`Created broadcast socket for interface ${target.localIP}`);
      } catch (err) {
        moduleLogger.warn(`Failed to create socket for interface ${target.localIP}: ${err}`);
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
      moduleLogger.warn(`Error closing socket for ${ip}: ${err}`);
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
        moduleLogger.warn(`No socket available for interface ${target.localIP}`);
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Failed to send announcement to ${target.broadcastIP}`));
        }, CONNECT_TIMEOUT);

        socket.send(p_message, LISTEN_PORT, target.broadcastIP, (err) => {
          clearTimeout(timeout);
          if (err) {
            if (!warnedTargets.has(target.broadcastIP)) {
              moduleLogger.warn(`Failed to send to ${target.broadcastIP}: ${err}`);
              warnedTargets.add(target.broadcastIP);
            } else {
              moduleLogger.debug(`Failed to send to ${target.broadcastIP}: ${err}`);
            }
            resolve(); // Don't reject, just log and continue
          } else {
            warnedTargets.delete(target.broadcastIP);
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

        announceClient!.send(p_message, LISTEN_PORT, broadcastIP, (err) => {
          clearTimeout(timeout);
          if (err) {
            if (!warnedTargets.has(broadcastIP)) {
              moduleLogger.warn(`Failed to send to ${broadcastIP}: ${err}`);
              warnedTargets.add(broadcastIP);
            } else {
              moduleLogger.debug(`Failed to send to ${broadcastIP}: ${err}`);
            }
            resolve();
          } else {
            // Clear warned state if a previously failing target recovers
            warnedTargets.delete(broadcastIP);
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
export async function unannounce(message: DiscoveryMessage, logger: Logger = noopLogger): Promise<void> {
  moduleLogger = logger;

  if (!announceTimer) {
    moduleLogger.warn('Announce timer has not started.');
    return;
  }
  // Note: assertion removed to fix freezing issues on disconnect
  // See: kyleawayan/StageLinq bb1ea5dfd
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

  moduleLogger.info("Unannounced myself");
}

/**
 * Start announcing presence on the StageLinq network
 */
export async function announce(message: DiscoveryMessage, logger: Logger = noopLogger): Promise<void> {
  moduleLogger = logger;

  if (announceTimer) {
    moduleLogger.debug('Already has an announce timer.')
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
  moduleLogger.info("Announced myself");
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
