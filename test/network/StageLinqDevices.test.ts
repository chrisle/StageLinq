/**
 * @fileoverview Unit tests for StageLinqDevices.getFileTransferService().
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before importing
vi.mock("../../services", () => ({
  FileTransfer: class {},
  StateData: class {},
  StateMap: class {},
}));

vi.mock("../../Databases", () => ({
  Databases: class {
    downloadSourcesFromDevice = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock("../../devices/Player", () => ({
  Player: class {
    on = vi.fn();
  },
}));

vi.mock("../../network", () => ({
  NetworkDevice: class {
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn();
    connectToService = vi.fn().mockResolvedValue({});
  },
}));

import { StageLinqDevices } from "../../network/StageLinqDevices";

describe("StageLinqDevices.getFileTransferService", () => {
  let devices: StageLinqDevices;

  beforeEach(() => {
    vi.useFakeTimers();
    devices = new StageLinqDevices(
      { actingAs: { source: "test-app" } } as any
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for unknown device", () => {
    const result = devices.getFileTransferService("net://unknown-device-id");
    expect(result).toBeNull();
  });

  it("returns FileTransfer service for known device", () => {
    const mockFileTransfer = { getFileSize: vi.fn(), getFile: vi.fn() };
    const devicesMap = (devices as any).devices as Map<string, any>;
    devicesMap.set("net://device-uuid-123", {
      networkDevice: {},
      fileTransferService: mockFileTransfer,
    });

    const result = devices.getFileTransferService("net://device-uuid-123");
    expect(result).toBe(mockFileTransfer);
  });

  it("returns null when file transfer is not available for device", () => {
    const devicesMap = (devices as any).devices as Map<string, any>;
    devicesMap.set("net://device-uuid-456", {
      networkDevice: {},
      fileTransferService: null,
    });

    const result = devices.getFileTransferService("net://device-uuid-456");
    expect(result).toBeNull();
  });
});
