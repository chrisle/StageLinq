import { describe, it, expect } from 'vitest';
import {
  createDiscoveryRequest,
  createDiscoveryResponse,
  parseDiscoveryResponse,
  isDiscoveryRequest,
} from '../../eaas/messages';
import { EAAS_MAGIC, EAAS_REQUEST_TYPE, EAAS_RESPONSE_TYPE } from '../../eaas/types';

describe('EAAS messages', () => {
  describe('createDiscoveryRequest', () => {
    it('creates a 6-byte request message', () => {
      const request = createDiscoveryRequest();

      expect(request).toBeInstanceOf(Uint8Array);
      expect(request.length).toBe(6);
    });

    it('starts with EAAS magic bytes', () => {
      const request = createDiscoveryRequest();
      const magic = new TextDecoder().decode(request.slice(0, 4));

      expect(magic).toBe(EAAS_MAGIC);
    });

    it('includes version byte 0x01', () => {
      const request = createDiscoveryRequest();

      expect(request[4]).toBe(0x01);
    });

    it('includes request type byte', () => {
      const request = createDiscoveryRequest();

      expect(request[5]).toBe(EAAS_REQUEST_TYPE);
    });
  });

  describe('isDiscoveryRequest', () => {
    it('returns true for valid discovery request', () => {
      const request = createDiscoveryRequest();

      expect(isDiscoveryRequest(request)).toBe(true);
    });

    it('returns false for wrong length', () => {
      const data = new Uint8Array([0x45, 0x41, 0x41, 0x53, 0x01]); // 5 bytes

      expect(isDiscoveryRequest(data)).toBe(false);
    });

    it('returns false for wrong magic', () => {
      const data = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01, 0x00]);

      expect(isDiscoveryRequest(data)).toBe(false);
    });

    it('returns false for wrong version', () => {
      const data = new Uint8Array([0x45, 0x41, 0x41, 0x53, 0x02, 0x00]);

      expect(isDiscoveryRequest(data)).toBe(false);
    });

    it('returns false for response type instead of request', () => {
      const data = new Uint8Array([0x45, 0x41, 0x41, 0x53, 0x01, EAAS_RESPONSE_TYPE]);

      expect(isDiscoveryRequest(data)).toBe(false);
    });
  });

  describe('createDiscoveryResponse', () => {
    it('creates a response with all fields', () => {
      const token = new Uint8Array(16).fill(0x42);
      const response = createDiscoveryResponse(
        token,
        'TestDevice',
        '192.168.1.100:50010',
        '1.0.0'
      );

      expect(response).toBeInstanceOf(Uint8Array);
      expect(response.length).toBeGreaterThan(22); // Minimum size
    });

    it('starts with EAAS magic and response type', () => {
      const token = new Uint8Array(16);
      const response = createDiscoveryResponse(token, 'Test', 'url', '1.0');

      const magic = new TextDecoder().decode(response.slice(0, 4));
      expect(magic).toBe(EAAS_MAGIC);
      expect(response[4]).toBe(0x01); // Version
      expect(response[5]).toBe(EAAS_RESPONSE_TYPE);
    });

    it('includes token bytes', () => {
      const token = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const response = createDiscoveryResponse(token, 'Test', 'url', '1.0');

      // Token starts at offset 6
      for (let i = 0; i < 16; i++) {
        expect(response[6 + i]).toBe(i + 1);
      }
    });
  });

  describe('parseDiscoveryResponse', () => {
    it('parses a valid response', () => {
      const token = new Uint8Array(16).fill(0xAB);
      const response = createDiscoveryResponse(
        token,
        'SC6000',
        '192.168.1.100:50010',
        '2.0.0'
      );

      const parsed = parseDiscoveryResponse(response, '192.168.1.100');

      expect(parsed).not.toBeNull();
      expect(parsed!.hostname).toBe('SC6000');
      expect(parsed!.softwareVersion).toBe('2.0.0');
      expect(parsed!.address).toBe('192.168.1.100');
    });

    it('returns null for too short data', () => {
      const data = new Uint8Array(10);

      expect(parseDiscoveryResponse(data, '127.0.0.1')).toBeNull();
    });

    it('returns null for wrong magic', () => {
      const data = new Uint8Array(50).fill(0);

      expect(parseDiscoveryResponse(data, '127.0.0.1')).toBeNull();
    });

    it('returns null for wrong version', () => {
      const data = new Uint8Array(50);
      data.set(new TextEncoder().encode(EAAS_MAGIC), 0);
      data[4] = 0x02; // Wrong version

      expect(parseDiscoveryResponse(data, '127.0.0.1')).toBeNull();
    });

    it('returns null for request type instead of response', () => {
      const data = new Uint8Array(50);
      data.set(new TextEncoder().encode(EAAS_MAGIC), 0);
      data[4] = 0x01;
      data[5] = EAAS_REQUEST_TYPE;

      expect(parseDiscoveryResponse(data, '127.0.0.1')).toBeNull();
    });

    it('extracts token from response', () => {
      const originalToken = new Uint8Array([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
      ]);
      const response = createDiscoveryResponse(
        originalToken,
        'Test',
        'url',
        '1.0'
      );

      const parsed = parseDiscoveryResponse(response, '127.0.0.1');

      expect(parsed).not.toBeNull();
      expect(parsed!.token).toEqual(originalToken);
    });

    it('roundtrips create and parse', () => {
      const token = new Uint8Array(16).fill(0x55);
      const hostname = 'Prime4';
      const url = '192.168.1.50:50010';
      const version = '3.0.0';

      const response = createDiscoveryResponse(token, hostname, url, version);
      const parsed = parseDiscoveryResponse(response, '192.168.1.50');

      expect(parsed).not.toBeNull();
      expect(parsed!.hostname).toBe(hostname);
      expect(parsed!.softwareVersion).toBe(version);
    });

    it('sets default ports when not in URL', () => {
      const token = new Uint8Array(16);
      const response = createDiscoveryResponse(token, 'Test', '192.168.1.1', '1.0');
      const parsed = parseDiscoveryResponse(response, '192.168.1.1');

      expect(parsed).not.toBeNull();
      expect(parsed!.grpcPort).toBe(50010);
      expect(parsed!.httpPort).toBe(50020);
    });

    it('parses port from URL', () => {
      const token = new Uint8Array(16);
      const response = createDiscoveryResponse(token, 'Test', '192.168.1.1:12345', '1.0');
      const parsed = parseDiscoveryResponse(response, '192.168.1.1');

      expect(parsed).not.toBeNull();
      expect(parsed!.grpcPort).toBe(12345);
      expect(parsed!.httpPort).toBe(12355); // grpcPort + 10
    });
  });
});
