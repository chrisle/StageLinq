/**
 * EAAS Module
 *
 * Engine Application & Streaming (EAAS) protocol support for Denon DJ devices.
 * EAAS provides gRPC and HTTP APIs for accessing music libraries, track metadata,
 * and streaming capabilities.
 *
 * Ported from go-stagelinq by Carl Kittelberger (icedream)
 * Original: https://github.com/icedream/go-stagelinq
 * License: MIT
 *
 * @example
 * ```typescript
 * import { EAASDiscoverer } from 'stagelinq/eaas';
 *
 * const discoverer = new EAASDiscoverer();
 *
 * discoverer.on('discovered', (device) => {
 *   console.log(`Found: ${device.hostname}`);
 *   console.log(`  gRPC: ${device.address}:${device.grpcPort}`);
 *   console.log(`  HTTP: ${device.address}:${device.httpPort}`);
 * });
 *
 * const devices = await discoverer.discover();
 * ```
 */
export * from './types';
export * from './messages';
export * from './discoverer';
export * from './beacon';
export * from './grpc-types';
export * from './engine-library-client';
export * from './http-client';
