/**
 * @fileoverview Regression tests for device connection retry/recovery.
 *
 * A Prime 4+ that was briefly unreachable at startup used to be dropped for the
 * whole session: the retry loop burned every attempt in one tick (an unawaited
 * sleep), only ran two of its three attempts, and then marked the device FAILED
 * forever — handleDevice ignores FAILED devices, so no later discovery message
 * could recover it. With no device there is no StateMap, so no channel-fader
 * signals reach the mix processor, and the overlay silently stops respecting the
 * fader (NP3-310).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

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

const connectMock = vi.fn();

vi.mock("../../network", () => ({
  NetworkDevice: class {
    connect = connectMock;
    disconnect = vi.fn();
    connectToService = vi.fn().mockResolvedValue({});
  },
}));

import { StageLinqDevices } from "../../network/StageLinqDevices";

/** Mirrors the Sentry report: prime4plus at 192.1.1.127:37167. */
const CONNECTION_INFO = {
  address: "192.1.1.127",
  port: 37167,
  source: "prime4plus",
  software: { name: "JC11", version: "1.0.0" },
  token: new Uint8Array([1, 2, 3, 4]),
} as any;

function makeDevices(maxRetries = 3) {
  return new StageLinqDevices({
    actingAs: { source: "test-app" },
    maxRetries,
    enableFileTranfer: false,
    downloadDbSources: false,
  } as any);
}

describe("StageLinqDevices connection retry", () => {
  beforeEach(() => {
    connectMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses every configured attempt, not maxRetries - 1", async () => {
    connectMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const devices = makeDevices(3);

    await expect(
      (devices as any).connectToDevice(CONNECTION_INFO),
    ).rejects.toThrow(/Could not connect/);

    expect(connectMock).toHaveBeenCalledTimes(3);
  });

  it("actually waits between attempts instead of burning them in one tick", async () => {
    connectMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const devices = makeDevices(3);

    const started = Date.now();
    await expect(
      (devices as any).connectToDevice(CONNECTION_INFO),
    ).rejects.toThrow(/Could not connect/);
    const elapsed = Date.now() - started;

    // Linear backoff: 500ms after attempt 1, 1000ms after attempt 2.
    // Without the await this whole loop completed in well under a millisecond.
    expect(elapsed).toBeGreaterThanOrEqual(1000);
  });

  it("recovers a failed device once the cooldown expires", async () => {
    connectMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const devices = makeDevices(1);

    await expect(
      (devices as any).connectToDevice(CONNECTION_INFO),
    ).rejects.toThrow(/Could not connect/);

    // Immediately afterwards the device is in cooldown and stays ignored...
    expect((devices as any).isFailed(CONNECTION_INFO)).toBe(true);

    // ...but once the cooldown lapses a fresh discovery message may retry it.
    const failedAt = (devices as any).failedAt as Map<string, number>;
    const id = (devices as any).deviceId(CONNECTION_INFO);
    failedAt.set(id, Date.now() - 11_000);

    expect((devices as any).isFailed(CONNECTION_INFO)).toBe(false);
    expect((devices as any).discoveryStatus.has(id)).toBe(false);
  });

  it("does not leave an unhandled rejection when a device never connects", async () => {
    connectMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const devices = makeDevices(1);

    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      await (devices as any).handleDevice(CONNECTION_INFO);
      // Give the detached connect promise a chance to reject and be caught.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});
