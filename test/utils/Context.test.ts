import { describe, it, expect } from 'vitest';
import { Context } from '../../utils/Context';

describe('Context', () => {
  describe('constructor', () => {
    it('creates context with buffer', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      expect(ctx.sizeLeft()).toBe(10);
    });

    it('defaults to little endian', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      expect(ctx.isLittleEndian()).toBe(true);
    });

    it('respects big endian option', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer, false);

      expect(ctx.isLittleEndian()).toBe(false);
    });

    it('respects explicit little endian option', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer, true);

      expect(ctx.isLittleEndian()).toBe(true);
    });
  });

  describe('sizeLeft', () => {
    it('returns full buffer size initially', () => {
      const buffer = new ArrayBuffer(100);
      const ctx = new Context(buffer);

      expect(ctx.sizeLeft()).toBe(100);
    });

    it('decreases as position advances', () => {
      const buffer = new ArrayBuffer(100);
      const ctx = new Context(buffer);

      ctx.seek(30);
      expect(ctx.sizeLeft()).toBe(70);
    });
  });

  describe('tell', () => {
    it('returns 0 initially', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      expect(ctx.tell()).toBe(0);
    });

    it('returns current position after seek', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      ctx.seek(5);
      expect(ctx.tell()).toBe(5);
    });
  });

  describe('seek', () => {
    it('advances position by offset', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      ctx.seek(3);
      expect(ctx.tell()).toBe(3);
    });

    it('supports negative offset', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      ctx.seek(5);
      ctx.seek(-2);
      expect(ctx.tell()).toBe(3);
    });

    it('throws when seeking before start', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      expect(() => ctx.seek(-1)).toThrow();
    });

    it('throws when seeking past end', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      expect(() => ctx.seek(11)).toThrow();
    });
  });

  describe('set', () => {
    it('sets position to absolute offset', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      ctx.set(7);
      expect(ctx.tell()).toBe(7);
    });

    it('allows setting to end of buffer', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      ctx.set(10);
      expect(ctx.tell()).toBe(10);
      expect(ctx.isEOF()).toBe(true);
    });

    it('throws for negative offset', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      expect(() => ctx.set(-1)).toThrow();
    });

    it('throws for offset beyond buffer', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      expect(() => ctx.set(11)).toThrow();
    });
  });

  describe('isEOF', () => {
    it('returns false when not at end', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      expect(ctx.isEOF()).toBe(false);
    });

    it('returns true when at end', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      ctx.set(10);
      expect(ctx.isEOF()).toBe(true);
    });

    it('returns true for empty buffer', () => {
      const buffer = new ArrayBuffer(0);
      const ctx = new Context(buffer);

      expect(ctx.isEOF()).toBe(true);
    });
  });

  describe('rewind', () => {
    it('resets position to 0', () => {
      const buffer = new ArrayBuffer(10);
      const ctx = new Context(buffer);

      ctx.seek(5);
      ctx.rewind();
      expect(ctx.tell()).toBe(0);
    });
  });
});
