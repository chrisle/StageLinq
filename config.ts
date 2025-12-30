/**
 * Global configuration for the StageLinq library.
 *
 * This module provides a way to configure library-wide settings
 * that need to be accessible from various internal modules.
 */

export type NetworkTapDirection = 'send' | 'recv' | 'discovery';

export interface NetworkTapInfo {
  direction: NetworkTapDirection;
  service?: string;
  address: string;
  port: number;
  data: Uint8Array;
}

export type NetworkTapCallback = (info: NetworkTapInfo) => void;

export interface StageLinqConfig {
  /** Callback invoked for every packet sent/received. Use for debugging/logging. */
  networkTap?: NetworkTapCallback;
}

const defaultConfig: StageLinqConfig = {};

let config: StageLinqConfig = { ...defaultConfig };

/**
 * Get the current configuration
 */
export function getConfig(): Readonly<StageLinqConfig> {
  return config;
}

/**
 * Update the configuration
 */
export function setConfig(newConfig: Partial<StageLinqConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  config = { ...defaultConfig };
}
