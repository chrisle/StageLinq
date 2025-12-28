"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.tokensEqual = exports.parseToken = exports.formatToken = void 0;
/**
 * Format a 16-byte token as a UUID string.
 *
 * @param token 16-byte Uint8Array token
 * @returns UUID-formatted string (e.g., "12345678-1234-1234-1234-123456789abc")
 */
function formatToken(token) {
    if (!token || token.length !== 16) {
        throw new Error(`Invalid token: expected 16 bytes, got ${token?.length ?? 0}`);
    }
    const hex = Buffer.from(token).toString('hex');
    const match = /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i.exec(hex);
    if (!match) {
        throw new Error('Failed to parse token as UUID');
    }
    return match.slice(1).join('-');
}
exports.formatToken = formatToken;
/**
 * Parse a UUID string back to a 16-byte token.
 *
 * @param uuid UUID-formatted string
 * @returns 16-byte Uint8Array token
 */
function parseToken(uuid) {
    const hex = uuid.replace(/-/g, '');
    if (hex.length !== 32) {
        throw new Error(`Invalid UUID: expected 32 hex characters, got ${hex.length}`);
    }
    return new Uint8Array(Buffer.from(hex, 'hex'));
}
exports.parseToken = parseToken;
/**
 * Check if two tokens are equal.
 *
 * @param a First token
 * @param b Second token
 * @returns true if tokens are identical
 */
function tokensEqual(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
exports.tokensEqual = tokensEqual;
/**
 * Generate a random 16-byte token.
 * Uses crypto.randomBytes for secure random generation.
 *
 * @returns 16-byte Uint8Array token
 */
function generateToken() {
    const crypto = require('crypto');
    return new Uint8Array(crypto.randomBytes(16));
}
exports.generateToken = generateToken;
//# sourceMappingURL=token.js.map