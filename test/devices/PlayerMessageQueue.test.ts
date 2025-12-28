import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlayerMessageQueue, UPDATE_RATE_MS } from '../../devices/PlayerMessageQueue';

describe('PlayerMessageQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('creates queue with layer identifier', () => {
      const queue = new PlayerMessageQueue('A');
      expect(queue).toBeInstanceOf(PlayerMessageQueue);
    });
  });

  describe('onDataReady', () => {
    it('returns self for chaining', () => {
      const queue = new PlayerMessageQueue('A');
      const callback = vi.fn();

      const result = queue.onDataReady(callback);

      expect(result).toBe(queue);
    });
  });

  describe('push', () => {
    it('adds data to queue', () => {
      const queue = new PlayerMessageQueue('A');
      const callback = vi.fn();
      queue.onDataReady(callback);

      queue.push({ play: true } as any);

      // Not called immediately
      expect(callback).not.toHaveBeenCalled();
    });

    it('triggers callback after UPDATE_RATE_MS', () => {
      const queue = new PlayerMessageQueue('A');
      const callback = vi.fn();
      queue.onDataReady(callback);

      queue.push({ play: true } as any);
      vi.advanceTimersByTime(UPDATE_RATE_MS);

      expect(callback).toHaveBeenCalled();
    });

    it('includes layer in output', () => {
      const queue = new PlayerMessageQueue('B');
      const callback = vi.fn();
      queue.onDataReady(callback);

      queue.push({ play: true } as any);
      vi.advanceTimersByTime(UPDATE_RATE_MS);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ layer: 'B' })
      );
    });
  });

  describe('message merging', () => {
    it('merges multiple messages into one', () => {
      const queue = new PlayerMessageQueue('A');
      const callback = vi.fn();
      queue.onDataReady(callback);

      queue.push({ play: true } as any);
      queue.push({ currentBpm: 128 } as any);
      queue.push({ trackName: 'Test Track' } as any);
      vi.advanceTimersByTime(UPDATE_RATE_MS);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          layer: 'A',
          play: true,
          currentBpm: 128,
          trackName: 'Test Track',
        })
      );
    });

    it('later values override earlier values', () => {
      const queue = new PlayerMessageQueue('A');
      const callback = vi.fn();
      queue.onDataReady(callback);

      queue.push({ currentBpm: 100 } as any);
      queue.push({ currentBpm: 128 } as any);
      queue.push({ currentBpm: 140 } as any);
      vi.advanceTimersByTime(UPDATE_RATE_MS);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          currentBpm: 140,
        })
      );
    });
  });

  describe('timing', () => {
    it('batches messages within UPDATE_RATE_MS window', () => {
      const queue = new PlayerMessageQueue('A');
      const callback = vi.fn();
      queue.onDataReady(callback);

      queue.push({ play: true } as any);
      vi.advanceTimersByTime(UPDATE_RATE_MS / 2);

      queue.push({ currentBpm: 128 } as any);
      vi.advanceTimersByTime(UPDATE_RATE_MS / 2);

      // Should be called once with both values merged
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('starts new batch after callback fires', () => {
      const queue = new PlayerMessageQueue('A');
      const callback = vi.fn();
      queue.onDataReady(callback);

      // First batch
      queue.push({ play: true } as any);
      vi.advanceTimersByTime(UPDATE_RATE_MS);
      expect(callback).toHaveBeenCalledTimes(1);

      // Second batch
      queue.push({ play: false } as any);
      vi.advanceTimersByTime(UPDATE_RATE_MS);
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('emptyCue', () => {
    it('clears the queue after firing', () => {
      const queue = new PlayerMessageQueue('A');
      const callback = vi.fn();
      queue.onDataReady(callback);

      queue.push({ play: true } as any);
      vi.advanceTimersByTime(UPDATE_RATE_MS);

      // First callback with play: true
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ play: true })
      );

      // Push new data
      queue.push({ play: false } as any);
      vi.advanceTimersByTime(UPDATE_RATE_MS);

      // Second callback should only have the new data
      expect(callback).toHaveBeenLastCalledWith(
        expect.objectContaining({ play: false })
      );
    });
  });
});
