import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';

// Mock fs and os modules
vi.mock('fs');
vi.mock('os');

import { getTempFilePath } from '../../utils/getTempFilePath';

describe('getTempFilePath', () => {
  beforeEach(() => {
    vi.mocked(os.tmpdir).mockReturnValue('/tmp');
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates path under temp directory', () => {
    const result = getTempFilePath('test/file.db');

    expect(result).toContain('/tmp/localdb');
    expect(result).toContain('file.db');
  });

  it('creates directory structure', () => {
    getTempFilePath('subdir/file.db');

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('/tmp/localdb'),
      { recursive: true }
    );
  });

  it('handles folder paths ending with /', () => {
    const result = getTempFilePath('folder/subfolder/');

    expect(fs.mkdirSync).toHaveBeenCalled();
    // Should not include filename for folder paths
    expect(result).not.toContain('.db');
  });

  it('handles folder paths ending with backslash', () => {
    const result = getTempFilePath('folder\\subfolder\\');

    expect(fs.mkdirSync).toHaveBeenCalled();
  });

  it('strips net:// prefix from paths', () => {
    const result = getTempFilePath('net://device-id/source/file.db');

    expect(result).not.toContain('net://');
    expect(result).toContain('device-id');
  });

  it('handles paths without subdirectories', () => {
    const result = getTempFilePath('file.db');

    expect(result).toContain('file.db');
    expect(fs.mkdirSync).toHaveBeenCalled();
  });

  it('handles deep nested paths', () => {
    const result = getTempFilePath('a/b/c/d/e/file.db');

    expect(result).toContain('file.db');
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('a/b/c/d/e'),
      { recursive: true }
    );
  });
});
