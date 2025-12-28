import { describe, it, expect } from 'vitest';
import { WriteContext } from './WriteContext';

describe('WriteContext', () => {
  describe('constructor', () => {
    it('creates context with default size', () => {
      const ctx = new WriteContext();
      expect(ctx.sizeLeft()).toBe(128);
    });

    it('creates context with custom size', () => {
      const ctx = new WriteContext({ size: 64 });
      expect(ctx.sizeLeft()).toBe(64);
    });

    it('enables autoGrow by default', () => {
      const ctx = new WriteContext();
      expect(ctx.autoGrow).toBe(true);
    });

    it('respects autoGrow option', () => {
      const ctx = new WriteContext({ autoGrow: false });
      expect(ctx.autoGrow).toBe(false);
    });
  });

  describe('write', () => {
    it('writes bytes to buffer', () => {
      const ctx = new WriteContext();
      const data = new Uint8Array([1, 2, 3, 4]);

      ctx.write(data);
      const result = ctx.getBuffer();

      expect(result.length).toBe(4);
      expect(result[0]).toBe(1);
      expect(result[3]).toBe(4);
    });

    it('returns number of bytes written', () => {
      const ctx = new WriteContext();
      const data = new Uint8Array([1, 2, 3]);

      const written = ctx.write(data);
      expect(written).toBe(3);
    });

    it('writes partial bytes when specified', () => {
      const ctx = new WriteContext();
      const data = new Uint8Array([1, 2, 3, 4, 5]);

      ctx.write(data, 3);
      const result = ctx.getBuffer();

      expect(result.length).toBe(3);
      expect(result[2]).toBe(3);
    });

    it('auto-grows when writing beyond capacity', () => {
      const ctx = new WriteContext({ size: 4 });
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

      ctx.write(data);
      const result = ctx.getBuffer();

      expect(result.length).toBe(8);
    });
  });

  describe('writeFixedSizedString', () => {
    it('writes ASCII string as bytes', () => {
      const ctx = new WriteContext();

      ctx.writeFixedSizedString('Hi');
      const result = ctx.getBuffer();

      expect(result.length).toBe(2);
      expect(result[0]).toBe(72); // 'H'
      expect(result[1]).toBe(105); // 'i'
    });

    it('returns string length', () => {
      const ctx = new WriteContext();
      const written = ctx.writeFixedSizedString('Test');
      expect(written).toBe(4);
    });
  });

  describe('writeNetworkStringUTF16', () => {
    it('writes length-prefixed UTF-16 string', () => {
      const ctx = new WriteContext();

      ctx.writeNetworkStringUTF16('Hi');
      const result = ctx.getBuffer();

      // 4 bytes for length + 4 bytes for "Hi" (2 chars * 2 bytes)
      expect(result.length).toBe(8);
      // Length prefix: 4 (2 chars * 2 bytes)
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(0);
      expect(result[2]).toBe(0);
      expect(result[3]).toBe(4);
      // 'H' in UTF-16BE
      expect(result[4]).toBe(0);
      expect(result[5]).toBe(72);
      // 'i' in UTF-16BE
      expect(result[6]).toBe(0);
      expect(result[7]).toBe(105);
    });

    it('handles empty string', () => {
      const ctx = new WriteContext();

      ctx.writeNetworkStringUTF16('');
      const result = ctx.getBuffer();

      expect(result.length).toBe(4);
      expect(result[3]).toBe(0);
    });

    it('returns total bytes written', () => {
      const ctx = new WriteContext();
      const written = ctx.writeNetworkStringUTF16('Test');
      // 4 bytes length + 8 bytes for 4 chars
      expect(written).toBe(12);
    });
  });

  describe('writeUInt64', () => {
    it('writes 64-bit unsigned integer in big endian', () => {
      const ctx = new WriteContext();

      ctx.writeUInt64(256n);
      const result = ctx.getBuffer();

      expect(result.length).toBe(8);
      expect(result[6]).toBe(1);
      expect(result[7]).toBe(0);
    });

    it('writes large 64-bit values', () => {
      const ctx = new WriteContext();

      ctx.writeUInt64(0x100000000n);
      const result = ctx.getBuffer();

      expect(result[3]).toBe(1);
    });

    it('returns 8', () => {
      const ctx = new WriteContext();
      const written = ctx.writeUInt64(0n);
      expect(written).toBe(8);
    });
  });

  describe('writeUInt32', () => {
    it('writes 32-bit unsigned integer in big endian', () => {
      const ctx = new WriteContext();

      ctx.writeUInt32(256);
      const result = ctx.getBuffer();

      expect(result.length).toBe(4);
      expect(result[2]).toBe(1);
      expect(result[3]).toBe(0);
    });

    it('writes 32-bit unsigned integer in little endian', () => {
      const ctx = new WriteContext({ littleEndian: true });

      ctx.writeUInt32(256);
      const result = ctx.getBuffer();

      expect(result[0]).toBe(0);
      expect(result[1]).toBe(1);
    });

    it('returns 4', () => {
      const ctx = new WriteContext();
      const written = ctx.writeUInt32(0);
      expect(written).toBe(4);
    });
  });

  describe('writeUInt16', () => {
    it('writes 16-bit unsigned integer in big endian', () => {
      const ctx = new WriteContext();

      ctx.writeUInt16(256);
      const result = ctx.getBuffer();

      expect(result.length).toBe(2);
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(0);
    });

    it('returns 2', () => {
      const ctx = new WriteContext();
      const written = ctx.writeUInt16(0);
      expect(written).toBe(2);
    });
  });

  describe('writeUInt8', () => {
    it('writes 8-bit unsigned integer', () => {
      const ctx = new WriteContext();

      ctx.writeUInt8(255);
      const result = ctx.getBuffer();

      expect(result.length).toBe(1);
      expect(result[0]).toBe(255);
    });

    it('returns 1', () => {
      const ctx = new WriteContext();
      const written = ctx.writeUInt8(0);
      expect(written).toBe(1);
    });
  });

  describe('getBuffer', () => {
    it('returns buffer with written data only', () => {
      const ctx = new WriteContext({ size: 128 });

      ctx.writeUInt8(1);
      ctx.writeUInt8(2);
      const result = ctx.getBuffer();

      expect(result.length).toBe(2);
    });
  });

  describe('resize', () => {
    it('doubles buffer size when auto-growing', () => {
      const ctx = new WriteContext({ size: 4 });

      // Write 5 bytes to trigger resize
      ctx.write(new Uint8Array([1, 2, 3, 4, 5]));

      expect(ctx.sizeLeft()).toBe(8 - 5); // 8 byte buffer, 5 written
    });
  });

  describe('tell', () => {
    it('returns current write position', () => {
      const ctx = new WriteContext();

      expect(ctx.tell()).toBe(0);
      ctx.writeUInt32(0);
      expect(ctx.tell()).toBe(4);
    });
  });

  describe('roundtrip with ReadContext', () => {
    it('data written can be read back correctly', async () => {
      const { ReadContext } = await import('./ReadContext');
      const writeCtx = new WriteContext();

      writeCtx.writeUInt32(12345);
      writeCtx.writeUInt16(6789);
      writeCtx.writeNetworkStringUTF16('Hello');
      writeCtx.writeUInt64(9876543210n);

      const buffer = writeCtx.getBuffer();
      const readCtx = new ReadContext(buffer.buffer);

      expect(readCtx.readUInt32()).toBe(12345);
      expect(readCtx.readUInt16()).toBe(6789);
      expect(readCtx.readNetworkStringUTF16()).toBe('Hello');
      expect(readCtx.readUInt64()).toBe(9876543210n);
    });
  });
});
