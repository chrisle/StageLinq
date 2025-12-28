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
export declare function parseNetworkPath(networkPath: string): ParsedNetworkPath | null;
/**
 * Convert a network path to a database-compatible track path.
 *
 * This is the primary function for resolving track paths from network
 * paths to paths that can be looked up in the Engine database.
 *
 * @param networkPath The full network path
 * @returns Track path for database lookup, or null if invalid
 */
export declare function networkPathToTrackPath(networkPath: string): string | null;
/**
 * Extract the source name from a network path.
 *
 * @param networkPath The full network path
 * @returns Source name (e.g., "USB 1", "(Internal)") or null if invalid
 */
export declare function getSourceFromNetworkPath(networkPath: string): string | null;
/**
 * Extract the device UUID from a network path.
 *
 * @param networkPath The full network path
 * @returns Device UUID or null if invalid
 */
export declare function getDeviceUuidFromNetworkPath(networkPath: string): string | null;
/**
 * Build a database source identifier from a network path.
 *
 * @param networkPath The full network path
 * @returns Source identifier (e.g., "net://uuid/source") or null if invalid
 */
export declare function getDbSourceId(networkPath: string): string | null;
