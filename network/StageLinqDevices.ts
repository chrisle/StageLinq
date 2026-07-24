import { ConnectionInfo, IpAddress, PlayerStatus, ServiceMessage, StageLinqOptions } from '../types';
import { EventEmitter } from 'events';
import { NetworkDevice } from '.';
import { Player } from '../devices/Player';
import { formatToken, sleep } from '../utils';
import { BeatInfo, FileTransfer, StateData, StateMap } from '../services';
import type { BeatData } from '../services';
import type { Logger } from '../types/logger';
import { noopLogger } from '../types/logger';
import { Databases } from '../Databases';

enum ConnectionStatus { CONNECTING, CONNECTED, FAILED };

interface StageLinqDevice {
  networkDevice: NetworkDevice;
  fileTransferService: FileTransfer | null;
};

// Initial poll interval for device discovery — just long enough for discovery
// messages from all devices to come through.
const WAIT_FOR_DEVICES_INITIAL_MS = 3000;
// Max poll interval after backoff when no devices are found
const WAIT_FOR_DEVICES_MAX_MS = 30000;
// Base linear backoff between device connection attempts (attempt N waits
// N * this). A device that is still booting needs real time between tries.
const RETRY_BACKOFF_MS = 500;
// How long a device stays in FAILED before a fresh discovery message is
// allowed to retry it. Without this a device that is briefly unreachable at
// startup is ignored for the entire session, so its channel faders never
// reach the mix processor and the overlay stops respecting them (NP3-310).
const RETRY_AFTER_FAILURE_MS = 10000;

export declare interface StageLinqDevices {
  on(event: 'trackLoaded', listener: (status: PlayerStatus) => void): this;
  on(event: 'stateChanged', listener: (status: PlayerStatus) => void): this;
  on(event: 'nowPlaying', listener: (status: PlayerStatus) => void): this;
  on(event: 'connected', listener: (connectionInfo: ConnectionInfo) => void): this;
  on(event: 'message', listener: (connectionInfo: ConnectionInfo, message: ServiceMessage<StateData>) => void): this;
  on(event: 'beatMessage', listener: (connectionInfo: ConnectionInfo, data: BeatData) => void): this;
  on(event: 'ready', listener: () => void): this;
}

//////////////////////////////////////////////////////////////////////////////

/**
 * Handle connecting and disconnecting from discovered devices on the
 * StageLinq network.
 */
export class StageLinqDevices extends EventEmitter {

  private _databases: Databases;
  private devices: Map<IpAddress, StageLinqDevice> = new Map();
  private discoveryStatus: Map<string, ConnectionStatus> = new Map();
  /** When each FAILED device last failed, for the retry cooldown. */
  private failedAt: Map<string, number> = new Map();
  /** Ignored mixers we have already warned about, so the log fires once each. */
  private loggedIgnoredMixers: Set<string> = new Set();
  private options: StageLinqOptions;
  private logger: Logger;

  private deviceWatchTimeout: NodeJS.Timeout | null = null;
  private deviceWatchInterval: number = WAIT_FOR_DEVICES_INITIAL_MS;
  private stateMapCallback: { connectionInfo: ConnectionInfo, networkDevice: NetworkDevice }[] = [];

  constructor(options: StageLinqOptions, logger: Logger = noopLogger) {
    super();
    this.options = options;
    this.logger = logger;
    this._databases = new Databases(logger);
    this.waitForAllDevices = this.waitForAllDevices.bind(this);
    this.waitForAllDevices();
  }

  /**
   * Handle incoming discovery messages from the StageLinq network
   *
   * @param connectionInfo Connection info.
   */
  async handleDevice(connectionInfo: ConnectionInfo) {
    this.logger.trace(this.showDiscoveryStatus(connectionInfo));

    // Ignore this discovery message if we've already connected to it,
    // are still connecting, if it has failed, or if it's blacklisted.
    if (this.isConnected(connectionInfo)
      || this.isConnecting(connectionInfo)
      || this.isFailed(connectionInfo)
      || this.isIgnored(connectionInfo)) return;

    // Deliberately not awaited — discovery must stay responsive — but the
    // rejection has to be handled here or a failed connection surfaces as an
    // unhandled promise rejection instead of a logged, recoverable failure.
    void this.connectToDevice(connectionInfo).catch((e) => {
      this.logger.warn(
        `Giving up on ${this.deviceId(connectionInfo)} for now ` +
        `(retry in ${RETRY_AFTER_FAILURE_MS / 1000}s): ${e}`);
    });
  }

  /**
   * Disconnect from all connected devices
   */
  disconnectAll() {
    if (this.deviceWatchTimeout) {
      clearTimeout(this.deviceWatchTimeout);
      this.deviceWatchTimeout = null;
    }
    for (const device of this.devices.values()) {
      device.networkDevice.disconnect();
    }
  }

  get databases() {
    return this._databases;
  }

  /**
   * Get the FileTransfer service for a specific device.
   * @param deviceId Device ID (e.g., "net://uuid-token")
   * @returns FileTransfer service or null if not available
   */
  getFileTransferService(deviceId: string): FileTransfer | null {
    const device = this.devices.get(deviceId);
    return device?.fileTransferService ?? null;
  }

  async downloadFile(deviceId: string, path: string) {
    if (this.options.enableFileTranfer) {
      const device = this.devices.get(deviceId);
      if (!device?.fileTransferService) {
        throw new Error(`Device ${deviceId} not found or file transfer not available`);
      }
      // Wait until FileTransfer.getFile is free
      await device.fileTransferService.waitTillAvailable();
      const file = await device.fileTransferService.getFile(path);
      return file;
    } else {
      const err = `File transfer service is not enabled. Cannot download ${path}`
      this.logger.error(err);
      throw new Error(err);
    }
  }

  ////////////////////////////////////////////////////////////////////////////

  /**
   * Waits for all devices to be connected with databases downloaded
   * then connects to the StateMap.
   *
   * Explained:
   *
   * Why wait for all devices? Because a race condition exists when using the
   * database methods.
   *
   * If there are two SC6000 players on the network both will be sending
   * broadcast packets and so their StateMap can be initialized at any time
   * in any order.
   *
   * Assume you have player 1 and player 2 linked. Player 2 has a track that
   * is loaded from a USB drive plugged into player 1. Player 2 will be
   * ready before Player 1 because Player 1 will still be downloading a large
   * database. The race condition is if you try to read from the database on
   * the track that is plugged into Player 1 that isn't ready yet.
   *
   * This method prevents that by waiting for both players to connect and
   * have their databases loaded before initializing the StateMap.
   *
   */
  private waitForAllDevices() {
    this.logger.debug('Start watching for devices ...');
    this.scheduleDeviceWatch();
  }

  private scheduleDeviceWatch() {
    this.deviceWatchTimeout = setTimeout(async () => {
      // Check if any devices are still connecting.
      const values = Array.from(this.discoveryStatus.values());
      const foundDevices = values.length >= 1;
      const allConnected = !values.includes(ConnectionStatus.CONNECTING);
      const entries = Array.from(this.discoveryStatus.entries());

      if (foundDevices && allConnected) {
        this.logger.debug('All devices found!');
        this.logger.debug(`Devices found: ${values.length} ${JSON.stringify(entries)}`);
        this.deviceWatchTimeout = null;
        for (const cb of this.stateMapCallback) {
          this.setupStateMap(cb.connectionInfo, cb.networkDevice);
        }
        this.emit('ready');
      } else {
        // Log at trace when idle (no devices), debug when devices are connecting
        if (foundDevices) {
          this.logger.debug(`Waiting devices: ${JSON.stringify(entries)}`);
        } else {
          this.logger.trace('Waiting for devices ...');
        }

        // Backoff: increase interval up to max when no devices are found
        if (!foundDevices && this.deviceWatchInterval < WAIT_FOR_DEVICES_MAX_MS) {
          this.deviceWatchInterval = Math.min(
            this.deviceWatchInterval * 2,
            WAIT_FOR_DEVICES_MAX_MS
          );
        } else if (foundDevices) {
          // Reset to fast polling when devices are actively connecting
          this.deviceWatchInterval = WAIT_FOR_DEVICES_INITIAL_MS;
        }

        this.scheduleDeviceWatch();
      }
    }, this.deviceWatchInterval);
  }

  /**
   * Attempt to connect to a device. Retry if necessary.
   *
   * @param connectionInfo Connection info
   * @returns
   */
  private async connectToDevice(connectionInfo: ConnectionInfo) {

    // Mark this device as connecting.
    this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.CONNECTING);

    const maxRetries = this.options.maxRetries ?? 3;
    let attempt = 1;
    while (attempt <= maxRetries) {
      try {

        // Connect to the device.
        this.logger.info(`Connecting to ${this.deviceId(connectionInfo)}. ` +
          `Attempt ${attempt}/${maxRetries}`);
        const networkDevice = new NetworkDevice(connectionInfo, this.logger);
        await networkDevice.connect();

        // Setup file transfer service
        await this.setupFileTransferService(networkDevice, connectionInfo);

        // Download the database
        if (this.options.enableFileTranfer && this.options.downloadDbSources) {
          await this.downloadDatabase(networkDevice, connectionInfo);
        }

        // Setup other services that should be initialized before StateMap here.

        // StateMap will be initialized after all devices have completed
        // this method. In other words, StateMap will initialize
        // after all entries in this.discoveryStatus return
        // ConnectionStatus.CONNECTED

        // Append to the list of states we need to setup later.
        this.stateMapCallback.push({ connectionInfo, networkDevice });

        // Mark this device as connected.
        this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.CONNECTED);
        this.emit('connected', connectionInfo);

        return; // Don't forget to return!
      } catch(e) {

        // Failed connection. Sleep then retry. The await matters: without it
        // the backoff is a no-op and every attempt fires in the same tick, so
        // a device that just needs a moment to settle burns all its retries in
        // microseconds and is marked FAILED.
        this.logger.warn(`Could not connect to ${this.deviceId(connectionInfo)} ` +
          `(${attempt}/${maxRetries}): ${e}`);
        attempt += 1;
        if (attempt <= maxRetries) {
          await sleep(RETRY_BACKOFF_MS * (attempt - 1));
        }
      }
    }
    // Every attempt failed. Mark it and stamp the time so the cooldown in
    // isFailed() can let a later discovery message retry the device.
    this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.FAILED);
    this.failedAt.set(this.deviceId(connectionInfo), Date.now());
    throw new Error(`Could not connect to ${this.deviceId(connectionInfo)}`);
  }

  private async setupFileTransferService(networkDevice: NetworkDevice, connectionInfo: ConnectionInfo) {
    const sourceId = this.sourceId(connectionInfo);

    if (this.options.enableFileTranfer) {
      this.logger.info(`Starting file transfer for ${this.deviceId(connectionInfo)}`);
      const fileTransferService = await networkDevice.connectToService(FileTransfer);
      this.devices.set(`net://${sourceId}`, {
        networkDevice: networkDevice,
        fileTransferService: fileTransferService
      });
    } else {
      this.devices.set(`net://${sourceId}`, {
        networkDevice: networkDevice,
        fileTransferService: null
      });
    }


  }

  /**
   * Download databases from the device.
   *
   * @param connectionInfo Connection info
   * @returns
   */
  private async downloadDatabase(networkDevice: NetworkDevice, connectionInfo: ConnectionInfo) {
    const sources = await this.databases.downloadSourcesFromDevice(connectionInfo, networkDevice);
    this.logger.debug(`Database sources: ${sources.join(', ')}`);
    this.logger.debug(`Database download complete for ${connectionInfo.source}`);
  }

  private sourceId(connectionInfo: ConnectionInfo) {
    return formatToken(connectionInfo.token);
  }

  /**
   * Setup stateMap.
   *
   * @param connectionInfo Connection info
   * @param networkDevice Network device
   */
  private async setupStateMap(connectionInfo: ConnectionInfo, networkDevice: NetworkDevice) {
    // Setup StateMap
    this.logger.debug(`Setting up stateMap for ${connectionInfo.address}`);

    const stateMap = await networkDevice.connectToService(StateMap);
    stateMap.on('message', (data) => {
      this.emit('message', connectionInfo, data)
    });

    // Setup Player
    const player = new Player({
      stateMap: stateMap,
      address: connectionInfo.address,
      port: connectionInfo.port,
      deviceId: this.sourceId(connectionInfo),
      logger: this.logger,
    });

    player.on('trackLoaded', (status) => {
      this.emit('trackLoaded', status);
    });

    player.on('stateChanged', (status) => {
      this.emit('stateChanged', status);
    });

    player.on('nowPlaying', (status) => {
      this.emit('nowPlaying', status);
    });

    // Setup BeatInfo for realtime beat/BPM data. Not every device advertises
    // this service, so failures here must not break state/track handling.
    try {
      const beatInfo = await networkDevice.connectToService(BeatInfo);
      beatInfo.on('beatMessage', (data: BeatData) => {
        this.emit('beatMessage', connectionInfo, data);
      });
    } catch (e) {
      this.logger.debug(`BeatInfo not available for ${connectionInfo.address}: ${e}`);
    }
  }

  private deviceId(device: ConnectionInfo) {
    return `${device.address}:${device.port}:` +
      `[${device.source}/${device.software.name}]`;
  }

  private isConnecting(device: ConnectionInfo) {
    return this.discoveryStatus.get(this.deviceId(device))
      === ConnectionStatus.CONNECTING;
  }

  private isConnected(device: ConnectionInfo) {
    return this.discoveryStatus.get(this.deviceId(device))
      === ConnectionStatus.CONNECTED;
  }

  /**
   * True while a device is in its post-failure cooldown.
   *
   * FAILED used to be terminal, which meant one unreachable moment at startup
   * removed a device for the whole session. Once the cooldown expires we drop
   * the status so the next discovery message reconnects it.
   */
  private isFailed(device: ConnectionInfo) {
    const id = this.deviceId(device);
    if (this.discoveryStatus.get(id) !== ConnectionStatus.FAILED) return false;

    const failedAt = this.failedAt.get(id) ?? 0;
    if (Date.now() - failedAt < RETRY_AFTER_FAILURE_MS) return true;

    this.logger.info(`Retrying previously failed device ${id}`);
    this.discoveryStatus.delete(id);
    this.failedAt.delete(id);
    return false;
  }

  private isIgnored(device: ConnectionInfo) {
    // X1800/X1850 mixers (software.name JM08) are ignored. On an SC-players +
    // X1850 rig this mixer is the ONLY device carrying channel faders, so
    // ignoring it may be why such a rig's fader is not respected in the overlay
    // (NP3-333 — an unverified suspicion; needs Denon hardware to confirm).
    // Behaviour is unchanged for now, but we surface each ignored mixer once so
    // a real user of this hardware shows up in telemetry instead of silently
    // degrading. Do NOT remove the ignore without checking why JM08 was added.
    if (device.software.name === 'JM08') {
      const id = this.deviceId(device);
      if (!this.loggedIgnoredMixers.has(id)) {
        this.loggedIgnoredMixers.add(id);
        this.logger.warn(
          `Ignoring StageLinQ mixer ${id} (X1800/X1850). If this rig relies on ` +
          `the mixer for channel faders, the overlay may not respect them (NP3-333).`
        );
      }
      return true;
    }

    return (
      device.source === this.options.actingAs?.source
      || device.software.name === 'OfflineAnalyzer'
      || /^SoundSwitch/i.test(device.software.name)
      || /^Resolume/i.test(device.software.name)
      || device.software.name === 'SSS0' // Ignore SoundSwitchEmbedded on players
    )
  }

  private isDeviceSeen(device: ConnectionInfo) {
    return this.discoveryStatus.has(device.address);
  }

  private showDiscoveryStatus(device: ConnectionInfo) {
    let msg = `Discovery: ${this.deviceId(device)} `;

    if (!this.isDeviceSeen) return msg += '(NEW)';
    if (this.isIgnored(device)) return msg += '(IGNORED)';
    return msg += (
      this.isConnecting(device) ? '(CONNECTING)'
      : this.isConnected(device) ? '(CONNECTED)'
      : this.isFailed(device) ? '(FAILED)'
      : '(NEW)');
  }

}