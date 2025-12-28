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

import {
  EAAS_MAGIC,
  EAAS_REQUEST_TYPE,
  EAAS_RESPONSE_TYPE,
  EAASDevice,
  EAAS_GRPC_PORT,
  EAAS_HTTP_PORT,
} from './types';

/**
 * Create an EAAS discovery request message.
 *
 * @returns 6-byte discovery request message
 */
export function createDiscoveryRequest(): Uint8Array {
  const buffer = new Uint8Array(6);
  const magic = new TextEncoder().encode(EAAS_MAGIC);

  buffer.set(magic, 0);
  buffer[4] = 0x01; // Version
  buffer[5] = EAAS_REQUEST_TYPE;

  return buffer;
}

/**
 * Create an EAAS discovery response message.
 *
 * @param device Device information to encode
 * @returns Discovery response message
 */
export function createDiscoveryResponse(
  token: Uint8Array,
  hostname: string,
  url: string,
  softwareVersion: string
): Uint8Array {
  // Calculate buffer size
  const hostnameUtf16 = encodeUTF16BE(hostname);
  const urlUtf8 = new TextEncoder().encode(url);
  const versionUtf16 = encodeUTF16BE(softwareVersion);

  const size = 6 + 16 + 4 + hostnameUtf16.length + 4 + urlUtf8.length + 4 + versionUtf16.length;
  const buffer = new Uint8Array(size);
  let offset = 0;

  // Magic bytes
  const magic = new TextEncoder().encode(EAAS_MAGIC);
  buffer.set(magic, offset);
  offset += 4;

  // Version and type
  buffer[offset++] = 0x01;
  buffer[offset++] = EAAS_RESPONSE_TYPE;

  // Token (16 bytes)
  buffer.set(token, offset);
  offset += 16;

  // Hostname (length-prefixed UTF-16 BE)
  const hostnameLen = new DataView(buffer.buffer);
  hostnameLen.setUint32(offset, hostnameUtf16.length, false);
  offset += 4;
  buffer.set(hostnameUtf16, offset);
  offset += hostnameUtf16.length;

  // URL (length-prefixed UTF-8)
  const urlLen = new DataView(buffer.buffer);
  urlLen.setUint32(offset, urlUtf8.length, false);
  offset += 4;
  buffer.set(urlUtf8, offset);
  offset += urlUtf8.length;

  // Software version (length-prefixed UTF-16 BE)
  const versionLen = new DataView(buffer.buffer);
  versionLen.setUint32(offset, versionUtf16.length, false);
  offset += 4;
  buffer.set(versionUtf16, offset);

  return buffer;
}

/**
 * Parse an EAAS discovery response message.
 *
 * @param data Raw message data
 * @param remoteAddress Address the message came from
 * @returns Parsed device info or null if invalid
 */
export function parseDiscoveryResponse(data: Uint8Array, remoteAddress: string): EAASDevice | null {
  if (data.length < 22) {
    return null; // Too short to be valid
  }

  // Check magic bytes
  const magic = new TextDecoder().decode(data.slice(0, 4));
  if (magic !== EAAS_MAGIC) {
    return null;
  }

  // Check version and type
  if (data[4] !== 0x01 || data[5] !== EAAS_RESPONSE_TYPE) {
    return null;
  }

  let offset = 6;

  // Read token (16 bytes)
  const token = new Uint8Array(data.slice(offset, offset + 16));
  offset += 16;

  const view = new DataView(data.buffer, data.byteOffset);

  // Read hostname (length-prefixed UTF-16 BE)
  if (offset + 4 > data.length) return null;
  const hostnameLen = view.getUint32(offset, false);
  offset += 4;

  if (offset + hostnameLen > data.length) return null;
  const hostname = decodeUTF16BE(data.slice(offset, offset + hostnameLen));
  offset += hostnameLen;

  // Read URL (length-prefixed UTF-8)
  if (offset + 4 > data.length) return null;
  const urlLen = view.getUint32(offset, false);
  offset += 4;

  if (offset + urlLen > data.length) return null;
  const url = new TextDecoder().decode(data.slice(offset, offset + urlLen));
  offset += urlLen;

  // Read software version (length-prefixed UTF-16 BE)
  let softwareVersion = '';
  if (offset + 4 <= data.length) {
    const versionLen = view.getUint32(offset, false);
    offset += 4;

    if (offset + versionLen <= data.length) {
      softwareVersion = decodeUTF16BE(data.slice(offset, offset + versionLen));
    }
  }

  // Parse port from URL if present, otherwise use defaults
  let grpcPort = EAAS_GRPC_PORT;
  let httpPort = EAAS_HTTP_PORT;

  const portMatch = url.match(/:(\d+)/);
  if (portMatch) {
    grpcPort = parseInt(portMatch[1], 10);
    httpPort = grpcPort + 10;
  }

  return {
    url: url || remoteAddress,
    hostname,
    softwareVersion,
    grpcPort,
    httpPort,
    token,
    address: remoteAddress,
  };
}

/**
 * Check if a message is an EAAS discovery request.
 *
 * @param data Raw message data
 * @returns true if this is a valid discovery request
 */
export function isDiscoveryRequest(data: Uint8Array): boolean {
  if (data.length !== 6) {
    return false;
  }

  const magic = new TextDecoder().decode(data.slice(0, 4));
  return magic === EAAS_MAGIC && data[4] === 0x01 && data[5] === EAAS_REQUEST_TYPE;
}

/**
 * Encode a string as UTF-16 Big Endian.
 */
function encodeUTF16BE(str: string): Uint8Array {
  const buffer = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    buffer[i * 2] = (code >> 8) & 0xff;
    buffer[i * 2 + 1] = code & 0xff;
  }
  return buffer;
}

/**
 * Decode UTF-16 Big Endian bytes to a string.
 */
function decodeUTF16BE(data: Uint8Array): string {
  let result = '';
  for (let i = 0; i < data.length; i += 2) {
    const code = (data[i] << 8) | data[i + 1];
    if (code === 0) break; // Null terminator
    result += String.fromCharCode(code);
  }
  return result;
}
