import { describe, it, expect } from 'vitest';
import { createDiscoveryMessage } from '../../network/announce';

describe('announce', () => {
  describe('createDiscoveryMessage', () => {
    it('creates a discovery message with all fields', () => {
      const token = new Uint8Array(16).fill(0x42);
      const options = {
        name: 'TestApp',
        version: '1.0.0',
        source: 'TestSource',
        token,
      };

      const message = createDiscoveryMessage('DISCOVERER_HOWDY_', options);

      expect(message.action).toBe('DISCOVERER_HOWDY_');
      expect(message.software.name).toBe('TestApp');
      expect(message.software.version).toBe('1.0.0');
      expect(message.source).toBe('TestSource');
      expect(message.token).toBe(token);
      expect(message.port).toBe(0);
    });

    it('creates login message', () => {
      const token = new Uint8Array(16);
      const options = {
        name: 'StageLinq',
        version: '2.0.0',
        source: 'NowPlaying',
        token,
      };

      const message = createDiscoveryMessage('DISCOVERER_HOWDY_', options);

      expect(message.action).toBe('DISCOVERER_HOWDY_');
    });

    it('creates logout message', () => {
      const token = new Uint8Array(16);
      const options = {
        name: 'StageLinq',
        version: '2.0.0',
        source: 'NowPlaying',
        token,
      };

      const message = createDiscoveryMessage('DISCOVERER_EXIT__', options);

      expect(message.action).toBe('DISCOVERER_EXIT__');
    });

    it('preserves token reference', () => {
      const token = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const options = {
        name: 'Test',
        version: '1.0',
        source: 'Source',
        token,
      };

      const message = createDiscoveryMessage('TEST_ACTION', options);

      expect(message.token).toBe(token);
      expect(message.token[0]).toBe(1);
      expect(message.token[15]).toBe(16);
    });

    it('uses provided software name and version', () => {
      const token = new Uint8Array(16);
      const options = {
        name: 'CustomApp',
        version: '3.2.1',
        source: 'MySource',
        token,
      };

      const message = createDiscoveryMessage('ACTION', options);

      expect(message.software.name).toBe('CustomApp');
      expect(message.software.version).toBe('3.2.1');
    });
  });
});
