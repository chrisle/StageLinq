/**
 * Token Utilities
 *
 * Helper functions for working with StageLinq device tokens.
 * Device tokens are 16-byte identifiers (UUIDs) that uniquely identify
 * devices on the StageLinq network.
 *
 * Token format ported from go-stagelinq by Carl Kittelberger (icedream)
 * Original: https://github.com/icedream/go-stagelinq
 * License: MIT
 */
/**
 * Format a 16-byte token as a UUID string.
 *
 * @param token 16-byte Uint8Array token
 * @returns UUID-formatted string (e.g., "12345678-1234-1234-1234-123456789abc")
 */
export declare function formatToken(token: Uint8Array): string;
/**
 * Parse a UUID string back to a 16-byte token.
 *
 * @param uuid UUID-formatted string
 * @returns 16-byte Uint8Array token
 */
export declare function parseToken(uuid: string): Uint8Array;
/**
 * Check if two tokens are equal.
 *
 * @param a First token
 * @param b Second token
 * @returns true if tokens are identical
 */
export declare function tokensEqual(a: Uint8Array, b: Uint8Array): boolean;
/**
 * Generate a random 16-byte token.
 * Uses crypto.randomBytes for secure random generation.
 *
 * @returns 16-byte Uint8Array token
 */
export declare function generateToken(): Uint8Array;
