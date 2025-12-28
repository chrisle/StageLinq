import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sleep } from '../../utils/sleep';

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a promise', () => {
    const result = sleep(100);
    expect(result).toBeInstanceOf(Promise);
  });

  it('resolves after specified milliseconds', async () => {
    const callback = vi.fn();

    sleep(1000).then(callback);

    expect(callback).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(callback).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(callback).toHaveBeenCalled();
  });

  it('works with 0 milliseconds', async () => {
    const callback = vi.fn();

    sleep(0).then(callback);

    await vi.advanceTimersByTimeAsync(0);
    expect(callback).toHaveBeenCalled();
  });

  it('resolves with undefined', async () => {
    const promise = sleep(100);
    vi.advanceTimersByTime(100);

    const result = await promise;
    expect(result).toBeUndefined();
  });
});
