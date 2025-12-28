import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Databases } from '../../Databases/Databases';

// Mock dependencies
vi.mock('../../services', () => ({
  FileTransfer: vi.fn(),
}));

vi.mock('../../network', () => ({
  NetworkDevice: vi.fn(),
}));

vi.mock('../../LogEmitter', () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('Databases', () => {
  let databases: Databases;

  beforeEach(() => {
    databases = new Databases();
  });

  describe('constructor', () => {
    it('creates instance with empty sources map', () => {
      expect(databases.sources).toBeInstanceOf(Map);
      expect(databases.sources.size).toBe(0);
    });

    it('extends EventEmitter', () => {
      expect(databases.on).toBeInstanceOf(Function);
      expect(databases.emit).toBeInstanceOf(Function);
    });
  });

  describe('getDbPath', () => {
    it('throws when no sources available', () => {
      expect(() => databases.getDbPath('some-source')).toThrow(
        'No data sources have been downloaded'
      );
    });

    it('returns path for existing source', () => {
      const sourceName = 'net://device-id/USB 1';
      const dbPath = '/tmp/localdb/device-id/USB 1/m.db';
      databases.sources.set(sourceName, dbPath);

      const result = databases.getDbPath(sourceName);

      expect(result).toBe(dbPath);
    });

    it('throws for non-existent source when sources exist', () => {
      databases.sources.set('net://device/Source1', '/path/to/db1');

      expect(() => databases.getDbPath('net://device/NonExistent')).toThrow(
        'Data source "net://device/NonExistent" doesn\'t exist'
      );
    });

    it('returns internal source for streaming tracks', () => {
      const internalPath = '/tmp/localdb/internal/m.db';
      databases.sources.set('net://device/(Internal)', internalPath);
      databases.sources.set('net://device/USB 1', '/tmp/usb/m.db');

      // When requesting unknown source with (Internal) available
      const result = databases.getDbPath('(Unknown)streaming://something');

      expect(result).toBe(internalPath);
    });

    it('returns undefined path when source name is undefined and no internal', () => {
      databases.sources.set('net://device/USB 1', '/tmp/usb/m.db');

      expect(() => databases.getDbPath(undefined)).toThrow();
    });
  });

  describe('events', () => {
    it('emits dbDownloaded event', () => {
      const handler = vi.fn();
      databases.on('dbDownloaded', handler);

      databases.emit('dbDownloaded', 'sourceName', '/path/to/db');

      expect(handler).toHaveBeenCalledWith('sourceName', '/path/to/db');
    });

    it('emits dbDownloading event', () => {
      const handler = vi.fn();
      databases.on('dbDownloading', handler);

      databases.emit('dbDownloading', 'sourceName', '/path/to/db');

      expect(handler).toHaveBeenCalledWith('sourceName', '/path/to/db');
    });

    it('emits dbProgress event', () => {
      const handler = vi.fn();
      databases.on('dbProgress', handler);

      databases.emit('dbProgress', 'sourceName', 1000, 500, 50);

      expect(handler).toHaveBeenCalledWith('sourceName', 1000, 500, 50);
    });
  });

  describe('sources Map', () => {
    it('can store multiple sources', () => {
      databases.sources.set('net://device1/USB 1', '/path1');
      databases.sources.set('net://device1/USB 2', '/path2');
      databases.sources.set('net://device2/Internal', '/path3');

      expect(databases.sources.size).toBe(3);
    });

    it('can check if source exists', () => {
      databases.sources.set('net://device/USB 1', '/path');

      expect(databases.sources.has('net://device/USB 1')).toBe(true);
      expect(databases.sources.has('net://device/USB 2')).toBe(false);
    });
  });
});
