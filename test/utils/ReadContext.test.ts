import { describe, it, expect } from 'vitest';
import { ReadContext } from '../../utils/ReadContext';

describe('ReadContext', () => {
  describe('read', () => {
    it('reads specified number of bytes', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const ctx = new ReadContext(buffer);

      const result = ctx.read(3);
      expect(result).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('advances position after read', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const ctx = new ReadContext(buffer);

      ctx.read(2);
      const result = ctx.read(2);
      expect(result).toEqual(new Uint8Array([3, 4]));
    });

    it('returns null when no bytes left', () => {
      const buffer = new Uint8Array([1, 2]).buffer;
      const ctx = new ReadContext(buffer);

      ctx.read(2);
      const result = ctx.read(1);
      expect(result).toBeNull();
    });

    it('reads only remaining bytes when requesting more', () => {
      const buffer = new Uint8Array([1, 2, 3]).buffer;
      const ctx = new ReadContext(buffer);

      const result = ctx.read(5);
      expect(result).toEqual(new Uint8Array([1, 2, 3]));
    });
  });

  describe('readRemaining', () => {
    it('reads all remaining bytes', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const ctx = new ReadContext(buffer);

      ctx.read(2);
      const result = ctx.readRemaining();
      expect(result).toEqual(new Uint8Array([3, 4, 5]));
    });
  });

  describe('readRemainingAsNewBuffer', () => {
    it('returns remaining bytes as Buffer', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const ctx = new ReadContext(buffer);

      ctx.read(2);
      const result = ctx.readRemainingAsNewBuffer();
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(3);
      expect(result[0]).toBe(3);
    });
  });

  describe('getString', () => {
    it('reads null-terminated string', () => {
      const buffer = new Uint8Array([72, 101, 108, 108, 111, 0, 88, 88]).buffer;
      const ctx = new ReadContext(buffer);

      const result = ctx.getString(8);
      expect(result).toBe('Hello');
    });
  });

  describe('readNetworkStringUTF16', () => {
    it('reads UTF-16 network string', () => {
      // Format: 4-byte length (in bytes), then UTF-16BE characters
      // "Hi" = 2 chars * 2 bytes = 4 bytes length prefix
      const buffer = new Uint8Array([
        0, 0, 0, 4,  // 4 bytes of character data
        0, 72,       // 'H' in UTF-16BE
        0, 105,      // 'i' in UTF-16BE
      ]).buffer;
      const ctx = new ReadContext(buffer);

      const result = ctx.readNetworkStringUTF16();
      expect(result).toBe('Hi');
    });

    it('handles empty string', () => {
      const buffer = new Uint8Array([0, 0, 0, 0]).buffer;
      const ctx = new ReadContext(buffer);

      const result = ctx.readNetworkStringUTF16();
      expect(result).toBe('');
    });
  });

  describe('readFloat64', () => {
    it('reads 64-bit float in big endian', () => {
      // IEEE 754 representation of 1.5 in big endian
      const buffer = new Uint8Array([0x3f, 0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]).buffer;
      const ctx = new ReadContext(buffer, false);

      const result = ctx.readFloat64();
      expect(result).toBe(1.5);
    });

    it('reads 64-bit float in little endian', () => {
      // IEEE 754 representation of 1.5 in little endian
      const buffer = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf8, 0x3f]).buffer;
      const ctx = new ReadContext(buffer, true);

      const result = ctx.readFloat64();
      expect(result).toBe(1.5);
    });
  });

  describe('readUInt64', () => {
    it('reads 64-bit unsigned integer in big endian', () => {
      const buffer = new Uint8Array([0, 0, 0, 0, 0, 0, 1, 0]).buffer;
      const ctx = new ReadContext(buffer, false);

      const result = ctx.readUInt64();
      expect(result).toBe(256n);
    });

    it('reads large 64-bit values', () => {
      const buffer = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]).buffer;
      const ctx = new ReadContext(buffer, false);

      const result = ctx.readUInt64();
      expect(result).toBe(0x100000000n);
    });
  });

  describe('readUInt32', () => {
    it('reads 32-bit unsigned integer in big endian', () => {
      const buffer = new Uint8Array([0, 0, 1, 0]).buffer;
      const ctx = new ReadContext(buffer, false);

      const result = ctx.readUInt32();
      expect(result).toBe(256);
    });

    it('reads 32-bit unsigned integer in little endian', () => {
      const buffer = new Uint8Array([0, 1, 0, 0]).buffer;
      const ctx = new ReadContext(buffer, true);

      const result = ctx.readUInt32();
      expect(result).toBe(256);
    });
  });

  describe('readInt32', () => {
    it('reads positive 32-bit signed integer', () => {
      const buffer = new Uint8Array([0, 0, 0, 127]).buffer;
      const ctx = new ReadContext(buffer, false);

      const result = ctx.readInt32();
      expect(result).toBe(127);
    });

    it('reads negative 32-bit signed integer', () => {
      const buffer = new Uint8Array([0xff, 0xff, 0xff, 0xff]).buffer;
      const ctx = new ReadContext(buffer, false);

      const result = ctx.readInt32();
      expect(result).toBe(-1);
    });
  });

  describe('readUInt16', () => {
    it('reads 16-bit unsigned integer in big endian', () => {
      const buffer = new Uint8Array([1, 0]).buffer;
      const ctx = new ReadContext(buffer, false);

      const result = ctx.readUInt16();
      expect(result).toBe(256);
    });

    it('reads 16-bit unsigned integer in little endian', () => {
      const buffer = new Uint8Array([0, 1]).buffer;
      const ctx = new ReadContext(buffer, true);

      const result = ctx.readUInt16();
      expect(result).toBe(256);
    });
  });

  describe('readUInt8', () => {
    it('reads 8-bit unsigned integer', () => {
      const buffer = new Uint8Array([255]).buffer;
      const ctx = new ReadContext(buffer);

      const result = ctx.readUInt8();
      expect(result).toBe(255);
    });

    it('advances position by 1', () => {
      const buffer = new Uint8Array([1, 2, 3]).buffer;
      const ctx = new ReadContext(buffer);

      ctx.readUInt8();
      const result = ctx.readUInt8();
      expect(result).toBe(2);
    });
  });

  describe('isEOF', () => {
    it('returns false when data remains', () => {
      const buffer = new Uint8Array([1, 2]).buffer;
      const ctx = new ReadContext(buffer);

      expect(ctx.isEOF()).toBe(false);
    });

    it('returns true when at end', () => {
      const buffer = new Uint8Array([1]).buffer;
      const ctx = new ReadContext(buffer);

      ctx.read(1);
      expect(ctx.isEOF()).toBe(true);
    });
  });

  describe('seek', () => {
    it('advances position by offset', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const ctx = new ReadContext(buffer);

      ctx.seek(2);
      const result = ctx.readUInt8();
      expect(result).toBe(3);
    });
  });

  describe('tell', () => {
    it('returns current position', () => {
      const buffer = new Uint8Array([1, 2, 3]).buffer;
      const ctx = new ReadContext(buffer);

      expect(ctx.tell()).toBe(0);
      ctx.read(2);
      expect(ctx.tell()).toBe(2);
    });
  });
});
