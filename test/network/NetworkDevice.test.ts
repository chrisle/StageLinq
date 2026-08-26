import { describe, it, expect } from 'vitest';
import { NetworkDevice } from '../../network/NetworkDevice';
import { MessageId } from '../../types';
import type { ConnectionInfo, ServicePorts } from '../../types';
import type { Logger } from '../../types/logger';

/**
 * Framing tests for the device discovery stream.
 *
 * Unlike the service streams these messages carry no length prefix, so the
 * reader has to know each message's shape to tell "not all here yet" from
 * "this is not where a message starts". Getting that wrong used to run the
 * parser off the end of the buffer, and the assert escaped into the socket's
 * 'data' handler as an uncaught exception (Sentry NOW-PLAYING-3-30/31/32).
 */

/** Any 16 byte token; the parser skips it without looking. */
const TOKEN = Buffer.alloc(16, 0xab);

function announcement(service: string, port: number): Buffer {
  const name = Buffer.alloc(service.length * 2);
  for (let i = 0; i < service.length; ++i) {
    name.writeUInt16BE(service.charCodeAt(i), i * 2);
  }
  const out = Buffer.alloc(4 + 16 + 4 + name.byteLength + 2);
  out.writeUInt32BE(MessageId.ServicesAnnouncement, 0);
  TOKEN.copy(out, 4);
  out.writeUInt32BE(name.byteLength, 20);
  name.copy(out, 24);
  out.writeUInt16BE(port, 24 + name.byteLength);
  return out;
}

function timeStamp(seconds: number): Buffer {
  const out = Buffer.alloc(4 + 16 + 16 + 8);
  out.writeUInt32BE(MessageId.TimeStamp, 0);
  TOKEN.copy(out, 4);
  out.writeBigUInt64BE(BigInt(seconds) * 1000n * 1000n * 1000n, 36);
  return out;
}

function servicesRequest(): Buffer {
  const out = Buffer.alloc(4 + 16);
  out.writeUInt32BE(MessageId.ServicesRequest, 0);
  TOKEN.copy(out, 4);
  return out;
}

/** A well-formed header carrying an id the protocol does not define. */
function unknownMessage(id: number): Buffer {
  const out = Buffer.alloc(4 + 16);
  out.writeUInt32BE(id, 0);
  TOKEN.copy(out, 4);
  return out;
}

class TestLogger implements Logger {
  public readonly warnings: string[] = [];
  public readonly errors: string[] = [];
  trace() {}
  debug() {}
  info() {}
  warn(msg: string) {
    this.warnings.push(msg);
  }
  error(msg: string) {
    this.errors.push(msg);
  }
}

function newDevice() {
  const logger = new TestLogger();
  const info = { address: '192.168.1.172', port: 32901 } as ConnectionInfo;
  const device = new NetworkDevice(info, logger);
  return {
    device,
    logger,
    feed: (data: Buffer) => device.messageHandler(data),
    ports: () => (device as unknown as { servicePorts: ServicePorts }).servicePorts,
    requestAllowed: () => (device as unknown as { serviceRequestAllowed: boolean }).serviceRequestAllowed,
  };
}

describe('NetworkDevice message framing', () => {
  it('applies every message in a single read', () => {
    const d = newDevice();
    d.feed(Buffer.concat([announcement('StateMap', 40001), announcement('BeatInfo', 40002), servicesRequest()]));

    expect(d.ports()).toEqual({ StateMap: 40001, BeatInfo: 40002 });
    expect(d.requestAllowed()).toBe(true);
  });

  it('reassembles a message split across two reads', () => {
    const d = newDevice();
    const whole = announcement('FileTransfer', 44103);

    d.feed(whole.subarray(0, 21));
    expect(d.ports()).toEqual({});

    d.feed(whole.subarray(21));
    expect(d.ports()).toEqual({ FileTransfer: 44103 });
  });

  it('holds a header that is itself split across reads', () => {
    const d = newDevice();
    const whole = timeStamp(90);

    d.feed(whole.subarray(0, 2));
    expect(d.device.getTimeAlive()).toBe(0);

    d.feed(whole.subarray(2));
    expect(d.device.getTimeAlive()).toBe(90);
  });

  it('reassembles across three reads that each end mid-message', () => {
    const d = newDevice();
    const stream = Buffer.concat([announcement('StateMap', 40001), timeStamp(12), announcement('BeatInfo', 40002)]);

    for (let i = 0; i < stream.byteLength; i += 7) {
      d.feed(stream.subarray(i, i + 7));
    }

    expect(d.ports()).toEqual({ StateMap: 40001, BeatInfo: 40002 });
    expect(d.device.getTimeAlive()).toBe(12);
  });

  it('does not throw on an unhandled message id', () => {
    const d = newDevice();

    expect(() => d.feed(unknownMessage(3))).not.toThrow();
    expect(d.logger.warnings.some((w) => w.includes("Unhandled message id '3'"))).toBe(true);
  });

  it('warns once per unknown id rather than on every read', () => {
    const d = newDevice();
    d.feed(unknownMessage(3));
    d.feed(unknownMessage(3));

    expect(d.logger.warnings.filter((w) => w.includes("Unhandled message id '3'"))).toHaveLength(1);
  });

  it('keeps the messages that precede a desync in the same read', () => {
    const d = newDevice();
    d.feed(Buffer.concat([announcement('StateMap', 40001), unknownMessage(3), announcement('BeatInfo', 40002)]));

    // Framing is lost at the unknown id, so what follows it is unreachable —
    // but the announcement before it has already been applied.
    expect(d.ports()).toEqual({ StateMap: 40001 });
  });

  it('does not queue forever on an implausible service name length', () => {
    const d = newDevice();
    const bogus = Buffer.alloc(4 + 16 + 4);
    bogus.writeUInt32BE(MessageId.ServicesAnnouncement, 0);
    TOKEN.copy(bogus, 4);
    bogus.writeUInt32BE(0x00ffffff, 20);

    expect(() => d.feed(bogus)).not.toThrow();
    expect((d.device as unknown as { queue: Buffer | null }).queue).toBeNull();
  });

  it('reads a message whose Buffer is a slice of a larger backing store', () => {
    const d = newDevice();
    const whole = announcement('TimeSynchronization', 36859);
    // A Buffer with a non-zero byteOffset, as Buffer.concat and pooled socket
    // reads both produce. Reading `.buffer` directly would see the padding.
    const backing = Buffer.concat([Buffer.alloc(9, 0xee), whole, Buffer.alloc(9, 0xee)]);
    const view = backing.subarray(9, 9 + whole.byteLength);

    d.feed(view);
    expect(d.ports()).toEqual({ TimeSynchronization: 36859 });
  });
});
