import { extractMetadata, isExtensionSupported } from 'metadata-connect';
import type { ExtractedMetadata } from 'metadata-connect';
import type { FileTransfer } from '../services/FileTransfer';
import { createFileTransferReader } from './reader';

export type { ExtractedMetadata } from 'metadata-connect';

/**
 * Extract metadata from an audio file on a StageLinQ device
 *
 * This function reads only the necessary bytes from the file header,
 * avoiding the need to transfer entire audio files over the network.
 *
 * @param fileTransfer - The FileTransfer service connected to the device
 * @param networkPath - The file path on the device (from TrackNetworkPath signal)
 * @returns Extracted metadata, or null if extraction fails
 *
 * @example
 * ```typescript
 * // When a track is loaded, extract its metadata
 * const metadata = await extractMetadataFromDevice(fileTransfer, trackNetworkPath);
 * if (metadata) {
 *   console.log(metadata.title, metadata.artist);
 *   if (metadata.artwork) {
 *     // Display artwork
 *   }
 * }
 * ```
 */
export async function extractMetadataFromDevice(
  fileTransfer: FileTransfer,
  networkPath: string
): Promise<ExtractedMetadata | null> {
  // Skip streaming tracks (they don't have a file path)
  if (networkPath.includes('streaming://')) {
    return null;
  }

  // Get file extension and check if supported
  const extension = networkPath.split('.').pop()?.toLowerCase() ?? '';
  if (!isExtensionSupported(extension)) {
    return null;
  }

  try {
    // Get file size
    const size = await fileTransfer.getFileSize(networkPath);
    if (size === 0) {
      return null;
    }

    // Create reader and extract metadata
    const reader = createFileTransferReader(fileTransfer, networkPath, size);
    return await extractMetadata(reader);
  } catch {
    // Return null on any error (file not found, network issues, etc.)
    return null;
  }
}
