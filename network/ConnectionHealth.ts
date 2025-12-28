/**
 * Connection Health Monitor
 *
 * Monitors StageLinq connection health and handles reconnection.
 * Provides heartbeat checking, connection status events, and
 * automatic reconnection on connection loss.
 */

import { EventEmitter } from 'events';
import { Logger } from '../LogEmitter';

export interface ConnectionHealthOptions {
  /** Interval between heartbeat checks in milliseconds (default: 5000) */
  heartbeatInterval?: number;

  /** Time after which a connection is considered stale (default: 15000) */
  staleTimeout?: number;

  /** Maximum reconnection attempts (default: 3) */
  maxReconnectAttempts?: number;

  /** Delay between reconnection attempts in milliseconds (default: 2000) */
  reconnectDelay?: number;
}

export interface ConnectionStatus {
  /** Whether the connection is currently healthy */
  isHealthy: boolean;

  /** Timestamp of last successful activity */
  lastActivity: number;

  /** Number of missed heartbeats */
  missedHeartbeats: number;

  /** Current reconnection attempt (0 if not reconnecting) */
  reconnectAttempt: number;
}

export declare interface ConnectionHealth {
  on(event: 'healthy', listener: () => void): this;
  on(event: 'unhealthy', listener: (status: ConnectionStatus) => void): this;
  on(event: 'stale', listener: () => void): this;
  on(event: 'reconnecting', listener: (attempt: number) => void): this;
  on(event: 'reconnected', listener: () => void): this;
  on(event: 'reconnectFailed', listener: () => void): this;
}

/**
 * Connection Health Monitor
 *
 * Tracks connection health and provides reconnection capabilities.
 *
 * @example
 * ```typescript
 * const health = new ConnectionHealth({
 *   heartbeatInterval: 5000,
 *   staleTimeout: 15000,
 *   maxReconnectAttempts: 3,
 * });
 *
 * health.on('stale', () => {
 *   console.log('Connection is stale, attempting reconnect...');
 * });
 *
 * health.on('reconnected', () => {
 *   console.log('Successfully reconnected!');
 * });
 *
 * health.start();
 *
 * // Call this whenever you receive data
 * health.recordActivity();
 *
 * // Stop monitoring
 * health.stop();
 * ```
 */
export class ConnectionHealth extends EventEmitter {
  private options: Required<ConnectionHealthOptions>;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastActivityTime: number = Date.now();
  private missedHeartbeats: number = 0;
  private reconnectAttempt: number = 0;
  private isRunning: boolean = false;
  private _isHealthy: boolean = true;
  private reconnectCallback: (() => Promise<boolean>) | null = null;

  constructor(options: ConnectionHealthOptions = {}) {
    super();
    this.options = {
      heartbeatInterval: options.heartbeatInterval ?? 5000,
      staleTimeout: options.staleTimeout ?? 15000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 3,
      reconnectDelay: options.reconnectDelay ?? 2000,
    };
  }

  /**
   * Get current connection status.
   */
  getStatus(): ConnectionStatus {
    return {
      isHealthy: this._isHealthy,
      lastActivity: this.lastActivityTime,
      missedHeartbeats: this.missedHeartbeats,
      reconnectAttempt: this.reconnectAttempt,
    };
  }

  /**
   * Check if connection is currently healthy.
   */
  get isHealthy(): boolean {
    return this._isHealthy;
  }

  /**
   * Set the reconnection callback.
   * This function is called when the connection becomes stale.
   *
   * @param callback Function that attempts to reconnect. Returns true on success.
   */
  setReconnectCallback(callback: () => Promise<boolean>): void {
    this.reconnectCallback = callback;
  }

  /**
   * Start the health monitor.
   */
  start(): void {
    if (this.isRunning) {
      Logger.warn('ConnectionHealth: Already running');
      return;
    }

    this.isRunning = true;
    this.lastActivityTime = Date.now();
    this.missedHeartbeats = 0;
    this._isHealthy = true;

    this.heartbeatTimer = setInterval(() => {
      this.checkHealth();
    }, this.options.heartbeatInterval);

    Logger.debug('ConnectionHealth: Started monitoring');
  }

  /**
   * Stop the health monitor.
   */
  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.isRunning = false;
    Logger.debug('ConnectionHealth: Stopped monitoring');
  }

  /**
   * Record activity to indicate the connection is alive.
   * Call this whenever you receive data from the connection.
   */
  recordActivity(): void {
    this.lastActivityTime = Date.now();

    if (this.missedHeartbeats > 0) {
      Logger.debug(`ConnectionHealth: Activity restored after ${this.missedHeartbeats} missed heartbeats`);
      this.missedHeartbeats = 0;
    }

    if (!this._isHealthy) {
      this._isHealthy = true;
      this.reconnectAttempt = 0;
      this.emit('healthy');
    }
  }

  /**
   * Check connection health.
   */
  private async checkHealth(): Promise<void> {
    const now = Date.now();
    const timeSinceActivity = now - this.lastActivityTime;

    if (timeSinceActivity < this.options.heartbeatInterval) {
      // Connection is healthy
      if (this.missedHeartbeats > 0) {
        this.missedHeartbeats = 0;
        this._isHealthy = true;
        this.emit('healthy');
      }
      return;
    }

    // Missed a heartbeat
    this.missedHeartbeats++;
    Logger.debug(`ConnectionHealth: Missed heartbeat (${this.missedHeartbeats})`);

    if (timeSinceActivity >= this.options.staleTimeout) {
      // Connection is stale
      if (this._isHealthy) {
        this._isHealthy = false;
        this.emit('unhealthy', this.getStatus());
        this.emit('stale');

        // Attempt reconnection
        if (this.reconnectCallback) {
          await this.attemptReconnect();
        }
      }
    }
  }

  /**
   * Attempt to reconnect.
   */
  private async attemptReconnect(): Promise<void> {
    while (this.reconnectAttempt < this.options.maxReconnectAttempts) {
      this.reconnectAttempt++;
      this.emit('reconnecting', this.reconnectAttempt);

      Logger.info(`ConnectionHealth: Reconnect attempt ${this.reconnectAttempt}/${this.options.maxReconnectAttempts}`);

      try {
        const success = await this.reconnectCallback!();

        if (success) {
          Logger.info('ConnectionHealth: Reconnected successfully');
          this._isHealthy = true;
          this.reconnectAttempt = 0;
          this.lastActivityTime = Date.now();
          this.missedHeartbeats = 0;
          this.emit('reconnected');
          return;
        }
      } catch (err) {
        Logger.warn(`ConnectionHealth: Reconnect failed: ${err}`);
      }

      // Wait before next attempt
      if (this.reconnectAttempt < this.options.maxReconnectAttempts) {
        await new Promise((resolve) => setTimeout(resolve, this.options.reconnectDelay));
      }
    }

    // All attempts failed
    Logger.error('ConnectionHealth: All reconnect attempts failed');
    this.emit('reconnectFailed');
  }

  /**
   * Force a reconnection attempt.
   */
  async forceReconnect(): Promise<boolean> {
    if (!this.reconnectCallback) {
      Logger.warn('ConnectionHealth: No reconnect callback set');
      return false;
    }

    this.reconnectAttempt = 0;
    await this.attemptReconnect();
    return this._isHealthy;
  }

  /**
   * Reset the health monitor state.
   */
  reset(): void {
    this.lastActivityTime = Date.now();
    this.missedHeartbeats = 0;
    this.reconnectAttempt = 0;
    this._isHealthy = true;
  }
}
