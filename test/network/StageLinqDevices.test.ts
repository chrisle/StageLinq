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

const mockDownloadSourcesFromDevice = vi.fn().mockResolvedValue([]);
vi.mock("../../Databases", () => ({
  Databases: class {
    downloadSourcesFromDevice = (...args: unknown[]) =>
      mockDownloadSourcesFromDevice(...args);
    on = vi.fn();
    emit = vi.fn();
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

describe("StageLinqDevices database download (NP3-364)", () => {
  // The database is fetched to get the record label, which the StageLinQ wire
  // never carries. It must not gate track detection: it used to be awaited
  // inside connectToDevice, so the whole multi-megabyte transfer ran before any
  // track could be detected.

  const connectionInfo = {
    address: "192.168.1.10",
    port: 51337,
    source: "USB1",
    token: new Uint8Array(16),
    software: { name: "JP13" },
  } as any;

  function makeDevices() {
    return new StageLinqDevices({
      actingAs: { source: "test-app" },
      enableFileTranfer: true,
      downloadDbSources: true,
      maxRetries: 1,
    } as any);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mockDownloadSourcesFromDevice.mockReset();
    mockDownloadSourcesFromDevice.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("connects without waiting for the database download to finish", async () => {
    // A download that never settles stands in for a large library on a slow
    // link. Connecting must complete regardless.
    let release: (v: unknown) => void = () => {};
    mockDownloadSourcesFromDevice.mockReturnValue(
      new Promise((r) => {
        release = r;
      })
    );

    const devices = makeDevices();
    await (devices as any).connectToDevice(connectionInfo);

    expect(mockDownloadSourcesFromDevice).toHaveBeenCalledTimes(1);
    release([]);
  });

  it("does not fail the connection when the database download fails", async () => {
    // Losing the label is acceptable. Sending a working device back through the
    // retry loop over it is not.
    mockDownloadSourcesFromDevice.mockRejectedValue(new Error("transfer died"));

    const devices = makeDevices();
    await expect(
      (devices as any).connectToDevice(connectionInfo)
    ).resolves.toBeUndefined();

    await Promise.resolve();
    expect(mockDownloadSourcesFromDevice).toHaveBeenCalledTimes(1);
  });

  it("skips the download entirely when downloadDbSources is off", async () => {
    const devices = new StageLinqDevices({
      actingAs: { source: "test-app" },
      enableFileTranfer: true,
      downloadDbSources: false,
      maxRetries: 1,
    } as any);

    await (devices as any).connectToDevice(connectionInfo);

    expect(mockDownloadSourcesFromDevice).not.toHaveBeenCalled();
  });
});

describe("StageLinqDevices StateMap setup failure (NP3-447)", () => {
  // setupStateMap runs detached from the device-watch timer. When the device
  // drops off the network between discovery and StateMap setup, connecting to
  // the StateMap service times out (connect ETIMEDOUT). That rejection must be
  // logged, not surface as an uncaught error that crashes the app.

  const connectionInfo = {
    address: "192.168.2.108",
    port: 46185,
    source: "USB1",
    token: new Uint8Array(16),
    software: { name: "JP13" },
  } as any;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("logs and stays up when the StateMap connection times out", async () => {
    const logger = {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    const devices = new StageLinqDevices(
      { actingAs: { source: "test-app" } } as any,
      logger
    );

    const networkDevice = {
      connectToService: vi
        .fn()
        .mockRejectedValue(
          new Error("connect ETIMEDOUT 192.168.2.108:46185")
        ),
    } as any;

    (devices as any).stateMapCallback.push({ connectionInfo, networkDevice });
    // ConnectionStatus.CONNECTED === 1: makes the watch treat the device as
    // ready so it fires setupStateMap.
    (devices as any).discoveryStatus.set(
      (devices as any).deviceId(connectionInfo),
      1
    );

    const ready = vi.fn();
    devices.on("ready", ready);

    // Fire the scheduled device watch and flush the detached setupStateMap
    // promise. This throws if the rejection is left unhandled.
    await vi.runOnlyPendingTimersAsync();

    expect(networkDevice.connectToService).toHaveBeenCalled();
    expect(ready).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalled();
  });
});
