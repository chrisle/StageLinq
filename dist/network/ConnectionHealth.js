"use strict";
/**
 * Connection Health Monitor
 *
 * Monitors StageLinq connection health and handles reconnection.
 * Provides heartbeat checking, connection status events, and
 * automatic reconnection on connection loss.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionHealth = void 0;
const events_1 = require("events");
const LogEmitter_1 = require("../LogEmitter");
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
class ConnectionHealth extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.heartbeatTimer = null;
        this.lastActivityTime = Date.now();
        this.missedHeartbeats = 0;
        this.reconnectAttempt = 0;
        this.isRunning = false;
        this._isHealthy = true;
        this.reconnectCallback = null;
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
    getStatus() {
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
    get isHealthy() {
        return this._isHealthy;
    }
    /**
     * Set the reconnection callback.
     * This function is called when the connection becomes stale.
     *
     * @param callback Function that attempts to reconnect. Returns true on success.
     */
    setReconnectCallback(callback) {
        this.reconnectCallback = callback;
    }
    /**
     * Start the health monitor.
     */
    start() {
        if (this.isRunning) {
            LogEmitter_1.Logger.warn('ConnectionHealth: Already running');
            return;
        }
        this.isRunning = true;
        this.lastActivityTime = Date.now();
        this.missedHeartbeats = 0;
        this._isHealthy = true;
        this.heartbeatTimer = setInterval(() => {
            this.checkHealth();
        }, this.options.heartbeatInterval);
        LogEmitter_1.Logger.debug('ConnectionHealth: Started monitoring');
    }
    /**
     * Stop the health monitor.
     */
    stop() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        this.isRunning = false;
        LogEmitter_1.Logger.debug('ConnectionHealth: Stopped monitoring');
    }
    /**
     * Record activity to indicate the connection is alive.
     * Call this whenever you receive data from the connection.
     */
    recordActivity() {
        this.lastActivityTime = Date.now();
        if (this.missedHeartbeats > 0) {
            LogEmitter_1.Logger.debug(`ConnectionHealth: Activity restored after ${this.missedHeartbeats} missed heartbeats`);
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
    async checkHealth() {
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
        LogEmitter_1.Logger.debug(`ConnectionHealth: Missed heartbeat (${this.missedHeartbeats})`);
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
    async attemptReconnect() {
        while (this.reconnectAttempt < this.options.maxReconnectAttempts) {
            this.reconnectAttempt++;
            this.emit('reconnecting', this.reconnectAttempt);
            LogEmitter_1.Logger.info(`ConnectionHealth: Reconnect attempt ${this.reconnectAttempt}/${this.options.maxReconnectAttempts}`);
            try {
                const success = await this.reconnectCallback();
                if (success) {
                    LogEmitter_1.Logger.info('ConnectionHealth: Reconnected successfully');
                    this._isHealthy = true;
                    this.reconnectAttempt = 0;
                    this.lastActivityTime = Date.now();
                    this.missedHeartbeats = 0;
                    this.emit('reconnected');
                    return;
                }
            }
            catch (err) {
                LogEmitter_1.Logger.warn(`ConnectionHealth: Reconnect failed: ${err}`);
            }
            // Wait before next attempt
            if (this.reconnectAttempt < this.options.maxReconnectAttempts) {
                await new Promise((resolve) => setTimeout(resolve, this.options.reconnectDelay));
            }
        }
        // All attempts failed
        LogEmitter_1.Logger.error('ConnectionHealth: All reconnect attempts failed');
        this.emit('reconnectFailed');
    }
    /**
     * Force a reconnection attempt.
     */
    async forceReconnect() {
        if (!this.reconnectCallback) {
            LogEmitter_1.Logger.warn('ConnectionHealth: No reconnect callback set');
            return false;
        }
        this.reconnectAttempt = 0;
        await this.attemptReconnect();
        return this._isHealthy;
    }
    /**
     * Reset the health monitor state.
     */
    reset() {
        this.lastActivityTime = Date.now();
        this.missedHeartbeats = 0;
        this.reconnectAttempt = 0;
        this._isHealthy = true;
    }
}
exports.ConnectionHealth = ConnectionHealth;
//# sourceMappingURL=ConnectionHealth.js.map