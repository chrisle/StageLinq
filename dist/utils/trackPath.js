"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDbSourceId = exports.getDeviceUuidFromNetworkPath = exports.getSourceFromNetworkPath = exports.networkPathToTrackPath = exports.parseNetworkPath = void 0;
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
function parseNetworkPath(networkPath) {
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
    let trackPath;
    if (isEngineLibrary && parts.length > 5 && parts[5] === 'Music') {
        // Standard path: Engine Library/Music/...
        // Database stores paths relative to Music folder
        trackPath = parts.slice(6).join('/');
    }
    else if (isEngineLibrary) {
        // Engine Library but not in Music subfolder
        // Database path is relative to Engine Library
        trackPath = parts.slice(5).join('/');
    }
    else {
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
exports.parseNetworkPath = parseNetworkPath;
/**
 * Convert a network path to a database-compatible track path.
 *
 * This is the primary function for resolving track paths from network
 * paths to paths that can be looked up in the Engine database.
 *
 * @param networkPath The full network path
 * @returns Track path for database lookup, or null if invalid
 */
function networkPathToTrackPath(networkPath) {
    const parsed = parseNetworkPath(networkPath);
    return parsed?.trackPath ?? null;
}
exports.networkPathToTrackPath = networkPathToTrackPath;
/**
 * Extract the source name from a network path.
 *
 * @param networkPath The full network path
 * @returns Source name (e.g., "USB 1", "(Internal)") or null if invalid
 */
function getSourceFromNetworkPath(networkPath) {
    const parsed = parseNetworkPath(networkPath);
    return parsed?.sourceName ?? null;
}
exports.getSourceFromNetworkPath = getSourceFromNetworkPath;
/**
 * Extract the device UUID from a network path.
 *
 * @param networkPath The full network path
 * @returns Device UUID or null if invalid
 */
function getDeviceUuidFromNetworkPath(networkPath) {
    const parsed = parseNetworkPath(networkPath);
    return parsed?.deviceUuid ?? null;
}
exports.getDeviceUuidFromNetworkPath = getDeviceUuidFromNetworkPath;
/**
 * Build a database source identifier from a network path.
 *
 * @param networkPath The full network path
 * @returns Source identifier (e.g., "net://uuid/source") or null if invalid
 */
function getDbSourceId(networkPath) {
    const parsed = parseNetworkPath(networkPath);
    if (!parsed)
        return null;
    return `net://${parsed.deviceUuid}/${parsed.sourceName}`;
}
exports.getDbSourceId = getDbSourceId;
//# sourceMappingURL=trackPath.js.map