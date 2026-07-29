import { describe, it, expect } from 'vitest';
import { Service } from '../../services/Service';
import { ReadContext } from '../../utils/ReadContext';
import type { ServiceMessage } from '../../types';
import type { NetworkDevice } from '../../network/NetworkDevice';

/**
 * Framing tests for the length-prefixed message stream.
 *
 * A throw while parsing one message used to unwind past the framing loop,
 * discarding every later message in the same TCP read *and* the pending
 * partial-message queue. On Engine OS 5.x — where an oversized chunk threw on
 * every download — that turned a skipped message into corrupted reassembly.
 */

/** Payload byte that makes the test parser throw. */
const POISON = 0xff;

interface TestPayload {
  tag: number;
}

class TestService extends Service<TestPayload> {
  public readonly handled: number[] = [];

  async init() {}

  protected parseData(p_ctx: ReadContext): ServiceMessage<TestPayload> | null {
    const tag = p_ctx.readUInt8();
    if (tag === POISON) throw new Error('malformed message');
    return { id: tag, message: { tag } };
  }

  protected messageHandler(p_data: ServiceMessage<TestPayload>): void {
    this.handled.push(p_data.message.tag);
  }

  /** Feed bytes in as if they arrived from the socket. */
  public feed(p_data: Buffer): void {
    (this as unknown as { handleData(d: Buffer): void }).handleData(p_data);
  }
}

/** One length-prefixed message carrying a single tag byte. */
function frame(tag: number, padding = 0): Buffer {
  const payload = Buffer.alloc(1 + padding);
  payload[0] = tag;
  const out = Buffer.alloc(4 + payload.byteLength);
  out.writeUInt32BE(payload.byteLength, 0);
  payload.copy(out, 4);
  return out;
}

function newService(): TestService {
  return new TestService('127.0.0.1', 0, {} as NetworkDevice);
}

describe('Service message framing', () => {
  it('dispatches every message in a single read', () => {
    const service = newService();
    service.feed(Buffer.concat([frame(1), frame(2), frame(3)]));
    expect(service.handled).toEqual([1, 2, 3]);
  });

  it('keeps parsing after a malformed message in the same read', () => {
    const service = newService();
    service.feed(Buffer.concat([frame(1), frame(POISON), frame(3)]));
    // The bad message is skipped; the ones on either side survive.
    expect(service.handled).toEqual([1, 3]);
  });

  it('reassembles a message split across two reads', () => {
    const service = newService();
    const whole = frame(7, 32);
    service.feed(whole.subarray(0, 10));
    expect(service.handled).toEqual([]);
    service.feed(whole.subarray(10));
    expect(service.handled).toEqual([7]);
  });

  it('does not lose the queued partial message when an earlier message throws', () => {
    const service = newService();
    const trailing = frame(9, 16);
    // One bad message, then the first half of a good one.
    service.feed(Buffer.concat([frame(POISON), trailing.subarray(0, 8)]));
    expect(service.handled).toEqual([]);

    service.feed(trailing.subarray(8));
    expect(service.handled).toEqual([9]);
  });

  it('holds a length prefix that is itself split across reads', () => {
    const service = newService();
    const whole = frame(4);
    service.feed(whole.subarray(0, 2));
    service.feed(whole.subarray(2));
    expect(service.handled).toEqual([4]);
  });
});
