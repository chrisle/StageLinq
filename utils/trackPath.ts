/**
 * Track Path Utilities
 *
 * Resolves track paths from network paths to local database paths.
 * Handles various Engine DJ folder structures including:
 * - Standard Engine Library/Music paths
 * - Custom library locations
 * - External USB drives
 * - RekordBox conversions
 *
 * Track path resolution fix ported from kyleawayan/StageLinq
 * Original: https://github.com/kyleawayan/StageLinq
 *
 * @example Network path format:
 * net://[device-uuid]/[source-name]/[folder1]/[folder2]/[...]/filename.mp3
 */

export interface ParsedNetworkPath {
  /** Device UUID from the network path */
  deviceUuid: string;
  /** Source name (e.g., "(USB 1)", "(Internal)") */
  sourceName: string;
  /** Track path relative to the database */
  trackPath: string;
  /** Full folder path after source name */
  folderPath: string;
  /** Whether the path is inside Engine Library */
  isEngineLibrary: boolean;
}

/**
 * Parse a network path into its components.
 *
 * @param networkPath The full network path (net://uuid/source/path)
 * @returns Parsed path components or null if invalid
 *
 * @example
 * parseNetworkPath('net://12345678-1234-1234-1234-123456789abc/USB 1/Engine Library/Music/Artist/Track.mp3')
 * // Returns:
 * // {
 * //   deviceUuid: '12345678-1234-1234-1234-123456789abc',
 * //   sourceName: 'USB 1',
 * //   trackPath: 'Artist/Track.mp3',
 * //   folderPath: 'Engine Library/Music',
 * //   isEngineLibrary: true
 * // }
 */
export function parseNetworkPath(networkPath: string): ParsedNetworkPath | null {
  if (!networkPath || networkPath.length === 0) {
    return null;
  }

  const parts = networkPath.split('/');

  // Validate format: net://uuid/source/...
  if (parts.length < 4 || parts[0] !== 'net:' || parts[1] !== '') {
    return null;
  }

  const deviceUuid = parts[2];
  const sourceName = parts[3];

  // Validate UUID format (36 chars including dashes, or 32 hex chars)
  if (deviceUuid.length !== 36 && deviceUuid.length !== 32) {
    return null;
  }

  // Find where the actual file path starts
  const folderParts = parts.slice(4);
  const folderPath = folderParts.join('/');

  // Check if path is inside Engine Library
  const isEngineLibrary = parts[4] === 'Engine Library';

  // Calculate the track path for database lookup
  let trackPath: string;

  if (isEngineLibrary && parts.length > 5 && parts[5] === 'Music') {
    // Standard path: Engine Library/Music/...
    // Database stores paths relative to Music folder
    trackPath = parts.slice(6).join('/');
  } else if (isEngineLibrary) {
    // Engine Library but not in Music subfolder
    // Database path is relative to Engine Library
    trackPath = parts.slice(5).join('/');
  } else {
    // Outside Engine Library (USB drives, custom locations, RekordBox imports)
    // Prefix with ../ to indicate going up from Engine Library
    trackPath = `../${folderPath}`;
  }

  return {
    deviceUuid,
    sourceName,
    trackPath,
    folderPath,
    isEngineLibrary,
  };
}

/**
 * Convert a network path to a database-compatible track path.
 *
 * This is the primary function for resolving track paths from network
 * paths to paths that can be looked up in the Engine database.
 *
 * @param networkPath The full network path
 * @returns Track path for database lookup, or null if invalid
 */
export function networkPathToTrackPath(networkPath: string): string | null {
  const parsed = parseNetworkPath(networkPath);
  return parsed?.trackPath ?? null;
}

/**
 * Extract the source name from a network path.
 *
 * @param networkPath The full network path
 * @returns Source name (e.g., "USB 1", "(Internal)") or null if invalid
 */
export function getSourceFromNetworkPath(networkPath: string): string | null {
  const parsed = parseNetworkPath(networkPath);
  return parsed?.sourceName ?? null;
}

/**
 * Extract the device UUID from a network path.
 *
 * @param networkPath The full network path
 * @returns Device UUID or null if invalid
 */
export function getDeviceUuidFromNetworkPath(networkPath: string): string | null {
  const parsed = parseNetworkPath(networkPath);
  return parsed?.deviceUuid ?? null;
}

/**
 * Build a database source identifier from a network path.
 *
 * @param networkPath The full network path
 * @returns Source identifier (e.g., "net://uuid/source") or null if invalid
 */
export function getDbSourceId(networkPath: string): string | null {
  const parsed = parseNetworkPath(networkPath);
  if (!parsed) return null;
  return `net://${parsed.deviceUuid}/${parsed.sourceName}`;
}
