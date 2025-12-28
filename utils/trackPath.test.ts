import { describe, it, expect } from 'vitest';
import {
  parseNetworkPath,
  networkPathToTrackPath,
  getSourceFromNetworkPath,
  getDeviceUuidFromNetworkPath,
  getDbSourceId,
} from './trackPath';

describe('trackPath utilities', () => {
  const deviceUuid = '12345678-1234-1234-1234-123456789abc';

  describe('parseNetworkPath', () => {
    it('parses standard Engine Library/Music path', () => {
      const path = `net://${deviceUuid}/USB 1/Engine Library/Music/Artist/Album/Track.mp3`;
      const result = parseNetworkPath(path);

      expect(result).not.toBeNull();
      expect(result!.deviceUuid).toBe(deviceUuid);
      expect(result!.sourceName).toBe('USB 1');
      expect(result!.trackPath).toBe('Artist/Album/Track.mp3');
      expect(result!.folderPath).toBe('Engine Library/Music/Artist/Album/Track.mp3');
      expect(result!.isEngineLibrary).toBe(true);
    });

    it('parses Engine Library path without Music subfolder', () => {
      const path = `net://${deviceUuid}/Internal/Engine Library/Recordings/Track.mp3`;
      const result = parseNetworkPath(path);

      expect(result).not.toBeNull();
      expect(result!.trackPath).toBe('Recordings/Track.mp3');
      expect(result!.isEngineLibrary).toBe(true);
    });

    it('parses path outside Engine Library (USB root)', () => {
      const path = `net://${deviceUuid}/USB 1/DJ Music/Track.mp3`;
      const result = parseNetworkPath(path);

      expect(result).not.toBeNull();
      expect(result!.trackPath).toBe('../DJ Music/Track.mp3');
      expect(result!.isEngineLibrary).toBe(false);
    });

    it('parses path with RekordBox import structure', () => {
      const path = `net://${deviceUuid}/(USB 1)/Imported/rekordbox/Track.mp3`;
      const result = parseNetworkPath(path);

      expect(result).not.toBeNull();
      expect(result!.sourceName).toBe('(USB 1)');
      expect(result!.trackPath).toBe('../Imported/rekordbox/Track.mp3');
      expect(result!.isEngineLibrary).toBe(false);
    });

    it('parses path with parenthesized source name', () => {
      const path = `net://${deviceUuid}/(Internal)/Engine Library/Music/Track.mp3`;
      const result = parseNetworkPath(path);

      expect(result).not.toBeNull();
      expect(result!.sourceName).toBe('(Internal)');
    });

    it('returns null for empty string', () => {
      expect(parseNetworkPath('')).toBeNull();
    });

    it('returns null for null input', () => {
      expect(parseNetworkPath(null as unknown as string)).toBeNull();
    });

    it('returns null for invalid protocol', () => {
      expect(parseNetworkPath(`http://${deviceUuid}/USB 1/Track.mp3`)).toBeNull();
    });

    it('returns null for path without double slash', () => {
      expect(parseNetworkPath(`net:/${deviceUuid}/USB 1/Track.mp3`)).toBeNull();
    });

    it('returns null for path with invalid UUID length', () => {
      expect(parseNetworkPath('net://short-uuid/USB 1/Track.mp3')).toBeNull();
    });

    it('handles UUID without dashes (32 chars)', () => {
      const hexUuid = '12345678123412341234123456789abc';
      const path = `net://${hexUuid}/USB 1/Engine Library/Music/Track.mp3`;
      const result = parseNetworkPath(path);

      expect(result).not.toBeNull();
      expect(result!.deviceUuid).toBe(hexUuid);
    });

    it('handles deep folder structure', () => {
      const path = `net://${deviceUuid}/USB 1/Engine Library/Music/Genre/Artist/Year/Album/Disc 1/Track.mp3`;
      const result = parseNetworkPath(path);

      expect(result).not.toBeNull();
      expect(result!.trackPath).toBe('Genre/Artist/Year/Album/Disc 1/Track.mp3');
    });

    it('handles single track in Music folder', () => {
      const path = `net://${deviceUuid}/USB 1/Engine Library/Music/Track.mp3`;
      const result = parseNetworkPath(path);

      expect(result).not.toBeNull();
      expect(result!.trackPath).toBe('Track.mp3');
    });
  });

  describe('networkPathToTrackPath', () => {
    it('returns track path for valid network path', () => {
      const path = `net://${deviceUuid}/USB 1/Engine Library/Music/Artist/Track.mp3`;
      expect(networkPathToTrackPath(path)).toBe('Artist/Track.mp3');
    });

    it('returns null for invalid path', () => {
      expect(networkPathToTrackPath('invalid')).toBeNull();
    });
  });

  describe('getSourceFromNetworkPath', () => {
    it('returns source name for valid network path', () => {
      const path = `net://${deviceUuid}/USB 1/Engine Library/Music/Track.mp3`;
      expect(getSourceFromNetworkPath(path)).toBe('USB 1');
    });

    it('returns null for invalid path', () => {
      expect(getSourceFromNetworkPath('invalid')).toBeNull();
    });
  });

  describe('getDeviceUuidFromNetworkPath', () => {
    it('returns device UUID for valid network path', () => {
      const path = `net://${deviceUuid}/USB 1/Engine Library/Music/Track.mp3`;
      expect(getDeviceUuidFromNetworkPath(path)).toBe(deviceUuid);
    });

    it('returns null for invalid path', () => {
      expect(getDeviceUuidFromNetworkPath('invalid')).toBeNull();
    });
  });

  describe('getDbSourceId', () => {
    it('returns database source ID for valid network path', () => {
      const path = `net://${deviceUuid}/USB 1/Engine Library/Music/Track.mp3`;
      expect(getDbSourceId(path)).toBe(`net://${deviceUuid}/USB 1`);
    });

    it('returns null for invalid path', () => {
      expect(getDbSourceId('invalid')).toBeNull();
    });

    it('handles source names with parentheses', () => {
      const path = `net://${deviceUuid}/(USB 1)/Engine Library/Music/Track.mp3`;
      expect(getDbSourceId(path)).toBe(`net://${deviceUuid}/(USB 1)`);
    });
  });
});
