import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Logger } from '../../types/logger';
import type { DiscoveryMessage } from '../../types';

/**
 * A laptop with Wi-Fi asleep, a pulled cable, or a VPN-only routing table has
 * no interface to broadcast on. That used to assert inside the announce
 * interval, and since a timer callback is the top of its own stack the
 * rejection went unhandled — once per second, for as long as the machine
 * stayed offline (Sentry NOW-PLAYING-3-2R, 1261 events across 2 users).
 */

const state = vi.hoisted(() => ({ hasInterface: false }));

vi.mock('os', () => ({
  platform: () => 'darwin',
  networkInterfaces: () =>
    state.hasInterface
      ? { en0: [{ family: 'IPv4', internal: false, address: '192.168.1.50', netmask: '255.255.255.0' }] }
      : { lo0: [{ family: 'IPv4', internal: true, address: '127.0.0.1', netmask: '255.0.0.0' }] },
}));

vi.mock('dgram', () => ({
  createSocket: () => {
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    return {
      on(event: string, cb: (...args: unknown[]) => void) {
        handlers[event] = cb;
      },
      bind() {
        handlers.listening?.();
      },
      setBroadcast() {},
      send(_msg: unknown, _port: number, _address: string, cb: (err?: Error) => void) {
        cb();
      },
      close() {},
    };
  },
}));

class TestLogger implements Logger {
  public readonly warnings: string[] = [];
  public readonly infos: string[] = [];
  public readonly errors: string[] = [];
  trace() {}
  debug() {}
  info(msg: string) {
    this.infos.push(msg);
  }
  warn(msg: string) {
    this.warnings.push(msg);
  }
  error(msg: string) {
    this.errors.push(msg);
  }
}

type AnnounceModule = typeof import('../../network/announce');

let announceModule: AnnounceModule | null = null;
let message: DiscoveryMessage;

/**
 * announce.ts keeps its sockets, timer and warned-once flag at module scope,
 * so each test needs its own copy of the module rather than a shared one.
 */
async function freshAnnounce(): Promise<AnnounceModule> {
  vi.resetModules();
  announceModule = await import('../../network/announce');
  message = announceModule.createDiscoveryMessage('DISCOVERER_HOWDY_', {
    name: 'TestApp',
    version: '1.0.0',
    source: 'TestSource',
    token: new Uint8Array(16).fill(0x42),
  });
  return announceModule;
}

beforeEach(() => {
  state.hasInterface = false;
});

afterEach(async () => {
  await announceModule?.unannounce(message, new TestLogger()).catch(() => {});
  announceModule = null;
  vi.useRealTimers();
});

describe('announce with no broadcast targets', () => {
  it('starts without throwing and says why it is idle', async () => {
    const { announce } = await freshAnnounce();
    const logger = new TestLogger();

    await expect(announce(message, logger)).resolves.toBeUndefined();
    expect(logger.warnings.some((w) => w.includes('No broadcast targets found'))).toBe(true);
  });

  it('warns once, not on every tick', async () => {
    const { announce } = await freshAnnounce();
    const logger = new TestLogger();
    vi.useFakeTimers();

    await announce(message, logger);
    await vi.advanceTimersByTimeAsync(5000);

    expect(logger.warnings.filter((w) => w.includes('No broadcast targets found'))).toHaveLength(1);
  });

  it('resumes once an interface comes back', async () => {
    const { announce } = await freshAnnounce();
    const logger = new TestLogger();
    vi.useFakeTimers();

    await announce(message, logger);
    state.hasInterface = true;
    await vi.advanceTimersByTimeAsync(1000);

    expect(logger.infos.some((i) => i.includes('resuming announcements'))).toBe(true);
    expect(logger.errors).toEqual([]);
  });

  // Real timers: an unhandled rejection is reported on a macrotask that fake
  // timers never run, so the tick has to happen for real.
  it('leaves no unhandled rejection behind when a tick fires', async () => {
    const { announce } = await freshAnnounce();
    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      await announce(message, new TestLogger());
      await new Promise((resolve) => setTimeout(resolve, 1300));
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }

    expect(rejections).toEqual([]);
  });
});
