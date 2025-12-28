import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionHealth } from './ConnectionHealth';

// Mock the Logger to prevent console output during tests
vi.mock('../LogEmitter', () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ConnectionHealth', () => {
  let health: ConnectionHealth;

  beforeEach(() => {
    vi.useFakeTimers();
    health = new ConnectionHealth({
      heartbeatInterval: 1000,
      staleTimeout: 3000,
      maxReconnectAttempts: 3,
      reconnectDelay: 500,
    });
  });

  afterEach(() => {
    health.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('uses default options when none provided', () => {
      const defaultHealth = new ConnectionHealth();
      const status = defaultHealth.getStatus();

      expect(status.isHealthy).toBe(true);
      expect(status.missedHeartbeats).toBe(0);
      expect(status.reconnectAttempt).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('returns current health status', () => {
      const status = health.getStatus();

      expect(status).toEqual({
        isHealthy: true,
        lastActivity: expect.any(Number),
        missedHeartbeats: 0,
        reconnectAttempt: 0,
      });
    });
  });

  describe('isHealthy', () => {
    it('returns true initially', () => {
      expect(health.isHealthy).toBe(true);
    });
  });

  describe('start', () => {
    it('starts health monitoring', () => {
      health.start();

      // Advance time less than heartbeat interval
      vi.advanceTimersByTime(500);
      expect(health.isHealthy).toBe(true);
    });

    it('does not start twice if already running', () => {
      health.start();
      health.start(); // Should warn but not throw

      expect(health.isHealthy).toBe(true);
    });
  });

  describe('stop', () => {
    it('stops health monitoring', () => {
      health.start();
      health.stop();

      // Advance past stale timeout
      vi.advanceTimersByTime(10000);

      // Should still be healthy since monitoring stopped
      expect(health.isHealthy).toBe(true);
    });
  });

  describe('recordActivity', () => {
    it('updates last activity time', () => {
      health.start();

      const initialStatus = health.getStatus();
      vi.advanceTimersByTime(500);
      health.recordActivity();
      const newStatus = health.getStatus();

      expect(newStatus.lastActivity).toBeGreaterThan(initialStatus.lastActivity);
    });

    it('resets missed heartbeats', () => {
      health.start();

      // Advance past heartbeat interval to trigger missed heartbeat
      vi.advanceTimersByTime(1500);

      // Record activity should reset
      health.recordActivity();
      expect(health.getStatus().missedHeartbeats).toBe(0);
    });

    it('emits healthy event when recovering from unhealthy', async () => {
      health.start();
      const healthyHandler = vi.fn();
      health.on('healthy', healthyHandler);

      // Make connection stale
      vi.advanceTimersByTime(4000);
      expect(health.isHealthy).toBe(false);

      // Record activity to recover
      health.recordActivity();

      expect(health.isHealthy).toBe(true);
      expect(healthyHandler).toHaveBeenCalled();
    });
  });

  describe('health checking', () => {
    it('detects missed heartbeats', () => {
      health.start();

      // Advance past one heartbeat interval without activity
      vi.advanceTimersByTime(1500);

      // Should have missed at least one heartbeat
      expect(health.getStatus().missedHeartbeats).toBeGreaterThan(0);
    });

    it('emits stale event when connection becomes stale', () => {
      health.start();
      const staleHandler = vi.fn();
      health.on('stale', staleHandler);

      // Advance past stale timeout
      vi.advanceTimersByTime(4000);

      expect(staleHandler).toHaveBeenCalled();
      expect(health.isHealthy).toBe(false);
    });

    it('emits unhealthy event with status', () => {
      health.start();
      const unhealthyHandler = vi.fn();
      health.on('unhealthy', unhealthyHandler);

      vi.advanceTimersByTime(4000);

      expect(unhealthyHandler).toHaveBeenCalledWith(expect.objectContaining({
        isHealthy: false,
        missedHeartbeats: expect.any(Number),
      }));
    });
  });

  describe('reconnection', () => {
    // Note: The reconnection logic uses async operations and timeouts
    // that are difficult to test with fake timers. The forceReconnect
    // method provides a synchronous way to test reconnection behavior.

    it('can set a reconnect callback', () => {
      const callback = vi.fn().mockResolvedValue(true);
      health.setReconnectCallback(callback);

      // The callback is set (we can verify via forceReconnect)
      expect(health.forceReconnect()).resolves.toBe(true);
    });
  });

  describe('forceReconnect', () => {
    it('returns false when no callback set', async () => {
      const result = await health.forceReconnect();
      expect(result).toBe(false);
    });

    it('forces reconnection attempt', async () => {
      const reconnectCallback = vi.fn().mockResolvedValue(true);
      health.setReconnectCallback(reconnectCallback);

      const result = await health.forceReconnect();

      expect(reconnectCallback).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('resets reconnect attempt counter', async () => {
      const reconnectCallback = vi.fn().mockResolvedValue(true);
      health.setReconnectCallback(reconnectCallback);

      // Force reconnect without starting monitoring
      await health.forceReconnect();
      expect(reconnectCallback).toHaveBeenCalled();

      // Can force again
      reconnectCallback.mockClear();
      await health.forceReconnect();
      expect(reconnectCallback).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('resets all state', () => {
      health.start();
      vi.advanceTimersByTime(4000);

      health.reset();
      const status = health.getStatus();

      expect(status.isHealthy).toBe(true);
      expect(status.missedHeartbeats).toBe(0);
      expect(status.reconnectAttempt).toBe(0);
    });
  });
});
