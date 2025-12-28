/**
 * Connection Health Monitor
 *
 * Monitors StageLinq connection health and handles reconnection.
 * Provides heartbeat checking, connection status events, and
 * automatic reconnection on connection loss.
 */
/// <reference types="node" />
import { EventEmitter } from 'events';
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
export declare class ConnectionHealth extends EventEmitter {
    private options;
    private heartbeatTimer;
    private lastActivityTime;
    private missedHeartbeats;
    private reconnectAttempt;
    private isRunning;
    private _isHealthy;
    private reconnectCallback;
    constructor(options?: ConnectionHealthOptions);
    /**
     * Get current connection status.
     */
    getStatus(): ConnectionStatus;
    /**
     * Check if connection is currently healthy.
     */
    get isHealthy(): boolean;
    /**
     * Set the reconnection callback.
     * This function is called when the connection becomes stale.
     *
     * @param callback Function that attempts to reconnect. Returns true on success.
     */
    setReconnectCallback(callback: () => Promise<boolean>): void;
    /**
     * Start the health monitor.
     */
    start(): void;
    /**
     * Stop the health monitor.
     */
    stop(): void;
    /**
     * Record activity to indicate the connection is alive.
     * Call this whenever you receive data from the connection.
     */
    recordActivity(): void;
    /**
     * Check connection health.
     */
    private checkHealth;
    /**
     * Attempt to reconnect.
     */
    private attemptReconnect;
    /**
     * Force a reconnection attempt.
     */
    forceReconnect(): Promise<boolean>;
    /**
     * Reset the health monitor state.
     */
    reset(): void;
}
