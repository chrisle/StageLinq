import { describe, it, expect } from 'vitest';
import { FileTransfer, CHUNK_SIZE } from '../../services/FileTransfer';
import { ReadContext } from '../../utils/ReadContext';
import { WriteContext } from '../../utils/WriteContext';
import type { NetworkDevice } from '../../network/NetworkDevice';

/**
 * Engine OS 5.x sends FileTransfer chunks larger than the historical 4096-byte
 * CHUNK_SIZE. The library used to assert that ceiling, so every download threw,
 * stalled at 0% and timed out — which is what left Denon tracks with no ID3
 * metadata and no cover art.
 *
 * These tests drive the parser and the range reader with synthetic packets, so
 * they need no Prime hardware.
 */

const MESSAGE_ID_FILE_TRANSFER_ID = 0x4;
const MESSAGE_ID_FILE_TRANSFER_CHUNK = 0x5;

/** Build a raw FileTransferChunk frame exactly as a device puts it on the wire. */
function chunkFrame(options: { offset: number; data: Buffer; declaredSize?: number }): ReadContext {
  const declaredSize = options.declaredSize ?? options.data.byteLength;
  const ctx = new WriteContext({ autoGrow: true });
  ctx.writeFixedSizedString('fltx');
  ctx.writeUInt32(0x0); // code 0 => not a timecode
  ctx.writeUInt32(MESSAGE_ID_FILE_TRANSFER_CHUNK);
  ctx.writeUInt32(0x0);
  ctx.writeUInt32(options.offset);
  ctx.writeUInt32(declaredSize);
  ctx.write(options.data);

  const buf = ctx.getBuffer();
  return new ReadContext(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), false);
}

/** Deterministic file content, so a returned range can be checked byte-for-byte. */
function fileContent(size: number): Buffer {
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i++) buf[i] = i % 251;
  return buf;
}

/**
 * A FileTransfer wired to a fake device that answers requests with chunks of
 * `chunkSize`. The real chunk maths, accumulation and slicing all still run.
 */
function fakeDevice(options: { fileSize: number; chunkSize: number }) {
  const service = new FileTransfer('127.0.0.1', 0, {} as NetworkDevice);
  const content = fileContent(options.fileSize);
  const requestedRanges: Array<{ start: number; end: number }> = [];

  const patch = service as unknown as Record<string, unknown>;

  patch.requestFileTransferId = async () => {
    // setTimeout, not a microtask: the caller registers its listener after
    // awaiting this, so an immediate emit would be missed.
    setTimeout(() => {
      service.emit('message', {
        id: MESSAGE_ID_FILE_TRANSFER_ID,
        message: { size: options.fileSize, txid: 1 },
      } as never);
    }, 0);
  };

  patch.requestChunkRange = async (_txid: number, start: number, end: number) => {
    requestedRanges.push({ start, end });
    setTimeout(() => {
      for (let i = start; i <= end; i++) {
        const byteStart = i * options.chunkSize;
        if (byteStart >= options.fileSize) break; // device stops at EOF
        const data = content.subarray(byteStart, Math.min(byteStart + options.chunkSize, options.fileSize));
        service.emit('message', {
          id: MESSAGE_ID_FILE_TRANSFER_CHUNK,
          message: { data, offset: byteStart, size: data.byteLength },
        } as never);
      }
    }, 0);
  };

  patch.signalTransferComplete = async () => {};

  return { service, content, requestedRanges };
}

describe('FileTransfer chunk parsing', () => {
  it('accepts a chunk larger than the assumed CHUNK_SIZE (Engine OS 5.x)', () => {
    const data = fileContent(CHUNK_SIZE * 2);
    const service = new FileTransfer('127.0.0.1', 0, {} as NetworkDevice);
    const parse = (
      service as unknown as {
        parseData(ctx: ReadContext): { id: number; message: { data: Buffer; offset: number; size: number } };
      }
    ).parseData;

    const parsed = parse.call(service, chunkFrame({ offset: 0, data }));

    expect(parsed.id).toBe(MESSAGE_ID_FILE_TRANSFER_CHUNK);
    expect(parsed.message.size).toBe(CHUNK_SIZE * 2);
    expect(Buffer.from(parsed.message.data).equals(data)).toBe(true);
  });

  it('still rejects a chunk whose declared size does not match its payload', () => {
    const data = fileContent(1024);
    const service = new FileTransfer('127.0.0.1', 0, {} as NetworkDevice);
    const parse = (service as unknown as { parseData(ctx: ReadContext): unknown }).parseData;

    expect(() => parse.call(service, chunkFrame({ offset: 0, data, declaredSize: 999 }))).toThrow();
  });
});

describe('FileTransfer whole-file download', () => {
  it('clamps a final chunk that overruns the declared file size', () => {
    const fileSize = 10_000;
    const service = new FileTransfer('127.0.0.1', 0, {} as NetworkDevice);
    const patch = service as unknown as { receivedFile: WriteContext; messageHandler(m: unknown): void };
    patch.receivedFile = new WriteContext({ size: fileSize });

    const chunk = fileContent(8192);
    patch.messageHandler.call(service, {
      id: MESSAGE_ID_FILE_TRANSFER_CHUNK,
      message: { data: chunk, offset: 0, size: chunk.byteLength },
    });

    // Second chunk overruns: 8192 + 8192 > 10000.
    expect(() =>
      patch.messageHandler.call(service, {
        id: MESSAGE_ID_FILE_TRANSFER_CHUNK,
        message: { data: chunk, offset: 8192, size: chunk.byteLength },
      })
    ).not.toThrow();

    // Write position must land exactly on EOF, or getFile() would spin.
    expect(patch.receivedFile.tell()).toBe(fileSize);
    expect(patch.receivedFile.isEOF()).toBe(true);
  });
});

describe('FileTransfer.getFileRange', () => {
  it('reads the file header correctly when the device uses 8192-byte chunks', async () => {
    const { service, content } = fakeDevice({ fileSize: 100_000, chunkSize: 8192 });

    const header = await service.getFileRange('/x.mp3', 0, 10);

    expect(header.equals(content.subarray(0, 10))).toBe(true);
  });

  it("measures the device chunk size and then requests in the device's units", async () => {
    const { service, content, requestedRanges } = fakeDevice({ fileSize: 100_000, chunkSize: 8192 });

    // First read is at offset 0, which is chunk 0 at any chunk size.
    await service.getFileRange('/x.mp3', 0, 10);
    requestedRanges.length = 0;

    // 50_000 / 8192 => chunk 6. Under the old hardcoded 4096 this asked for
    // chunk 12, which is byte 98_304 on the device: silently wrong bytes.
    const range = await service.getFileRange('/x.mp3', 50_000, 4_000);

    expect(requestedRanges[0].start).toBe(6);
    expect(range.equals(content.subarray(50_000, 54_000))).toBe(true);
  });

  it('probes for the chunk size when the very first read is not at offset 0', async () => {
    const { service, content } = fakeDevice({ fileSize: 100_000, chunkSize: 16_384 });

    const range = await service.getFileRange('/x.mp3', 40_000, 1_000);

    expect(range.equals(content.subarray(40_000, 41_000))).toBe(true);
  });

  it('returns rather than hanging when the requested range runs past EOF', async () => {
    const { service, content } = fakeDevice({ fileSize: 10_000, chunkSize: 8192 });

    // Asks for more than the file holds; the device simply stops at EOF, so
    // a chunk-count completion check would wait for chunks that never come.
    const range = await service.getFileRange('/x.mp3', 0, 50_000);

    expect(range.equals(content)).toBe(true);
  });

  it('serves a range from a file smaller than a single chunk', async () => {
    const { service, content } = fakeDevice({ fileSize: 3_000, chunkSize: 8192 });

    const range = await service.getFileRange('/x.mp3', 100, 200);

    expect(range.equals(content.subarray(100, 300))).toBe(true);
  });
});
