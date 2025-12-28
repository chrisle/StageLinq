/**
 * EAAS Messages
 *
 * Serialization and deserialization for EAAS discovery protocol messages.
 *
 * Discovery Message Format:
 * - Request: "EAAS" + [0x01, 0x00] (6 bytes)
 * - Response: "EAAS" + [0x01, 0x01] + token (16 bytes) + hostname (UTF-16) +
 *             URL (UTF-8) + software version (UTF-16) + separator (0x01) + extra data (UTF-16)
 *
 * Ported from go-stagelinq by Carl Kittelberger (icedream)
 * Original: https://github.com/icedream/go-stagelinq
 * License: MIT
 */
import { EAASDevice } from './types';
/**
 * Create an EAAS discovery request message.
 *
 * @returns 6-byte discovery request message
 */
export declare function createDiscoveryRequest(): Uint8Array;
/**
 * Create an EAAS discovery response message.
 *
 * @param device Device information to encode
 * @returns Discovery response message
 */
export declare function createDiscoveryResponse(token: Uint8Array, hostname: string, url: string, softwareVersion: string): Uint8Array;
/**
 * Parse an EAAS discovery response message.
 *
 * @param data Raw message data
 * @param remoteAddress Address the message came from
 * @returns Parsed device info or null if invalid
 */
export declare function parseDiscoveryResponse(data: Uint8Array, remoteAddress: string): EAASDevice | null;
/**
 * Check if a message is an EAAS discovery request.
 *
 * @param data Raw message data
 * @returns true if this is a valid discovery request
 */
export declare function isDiscoveryRequest(data: Uint8Array): boolean;
