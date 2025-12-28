import { describe, it, expect } from 'vitest';
import { formatToken, parseToken, tokensEqual, generateToken } from './token';

describe('token utilities', () => {
  // Sample token: 16 bytes that form a valid UUID
  const sampleToken = new Uint8Array([
    0x12, 0x34, 0x56, 0x78, // 8 hex chars
    0x12, 0x34,             // 4 hex chars
    0x12, 0x34,             // 4 hex chars
    0x12, 0x34,             // 4 hex chars
    0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc  // 12 hex chars
  ]);
  const sampleUuid = '12345678-1234-1234-1234-123456789abc';

  describe('formatToken', () => {
    it('formats a 16-byte token as a UUID string', () => {
      const result = formatToken(sampleToken);
      expect(result).toBe(sampleUuid);
    });

    it('throws for null token', () => {
      expect(() => formatToken(null as unknown as Uint8Array)).toThrow('Invalid token');
    });

    it('throws for undefined token', () => {
      expect(() => formatToken(undefined as unknown as Uint8Array)).toThrow('Invalid token');
    });

    it('throws for token with wrong length', () => {
      expect(() => formatToken(new Uint8Array([1, 2, 3]))).toThrow('expected 16 bytes, got 3');
    });

    it('throws for empty token', () => {
      expect(() => formatToken(new Uint8Array([]))).toThrow('expected 16 bytes, got 0');
    });

    it('handles zero token', () => {
      const zeroToken = new Uint8Array(16);
      const result = formatToken(zeroToken);
      expect(result).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('handles max value token', () => {
      const maxToken = new Uint8Array(16).fill(0xff);
      const result = formatToken(maxToken);
      expect(result).toBe('ffffffff-ffff-ffff-ffff-ffffffffffff');
    });
  });

  describe('parseToken', () => {
    it('parses a UUID string to a 16-byte token', () => {
      const result = parseToken(sampleUuid);
      expect(result).toEqual(sampleToken);
    });

    it('handles UUID without dashes', () => {
      const result = parseToken('123456781234123412341234567890ab');
      expect(result.length).toBe(16);
      expect(result[0]).toBe(0x12);
      expect(result[15]).toBe(0xab);
    });

    it('handles uppercase UUID', () => {
      const result = parseToken('12345678-1234-1234-1234-123456789ABC');
      expect(result).toEqual(sampleToken);
    });

    it('throws for invalid UUID length', () => {
      expect(() => parseToken('12345')).toThrow('expected 32 hex characters');
    });

    it('throws for empty string', () => {
      expect(() => parseToken('')).toThrow('expected 32 hex characters, got 0');
    });

    it('roundtrips with formatToken', () => {
      const uuid = '01234567-89ab-cdef-0123-456789abcdef';
      const token = parseToken(uuid);
      const result = formatToken(token);
      expect(result).toBe(uuid);
    });
  });

  describe('tokensEqual', () => {
    it('returns true for identical tokens', () => {
      const a = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const b = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      expect(tokensEqual(a, b)).toBe(true);
    });

    it('returns false for different tokens', () => {
      const a = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const b = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 99]);
      expect(tokensEqual(a, b)).toBe(false);
    });

    it('returns false for tokens of different lengths', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3, 4]);
      expect(tokensEqual(a, b)).toBe(false);
    });

    it('returns true for empty tokens', () => {
      const a = new Uint8Array([]);
      const b = new Uint8Array([]);
      expect(tokensEqual(a, b)).toBe(true);
    });

    it('returns true for same reference', () => {
      const a = new Uint8Array([1, 2, 3]);
      expect(tokensEqual(a, a)).toBe(true);
    });
  });

  describe('generateToken', () => {
    it('generates a 16-byte token', () => {
      const token = generateToken();
      expect(token).toBeInstanceOf(Uint8Array);
      expect(token.length).toBe(16);
    });

    it('generates different tokens on each call', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(tokensEqual(token1, token2)).toBe(false);
    });

    it('generates tokens that can be formatted as UUIDs', () => {
      const token = generateToken();
      const uuid = formatToken(token);
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });
});
