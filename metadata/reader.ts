import type { FileReader } from 'metadata-connect';
import type { FileTransfer } from '../services/FileTransfer';

/**
 * Create a FileReader that reads from a StageLinQ device via FileTransfer
 *
 * @param fileTransfer - The FileTransfer service connected to the device
 * @param path - The file path on the device
 * @param size - The file size in bytes
 * @returns FileReader interface for metadata extraction
 */
export function createFileTransferReader(
  fileTransfer: FileTransfer,
  path: string,
  size: number
): FileReader {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';

  return {
    size,
    extension,
    read: (offset: number, length: number): Promise<Buffer> =>
      fileTransfer.getFileRange(path, offset, length),
  };
}
