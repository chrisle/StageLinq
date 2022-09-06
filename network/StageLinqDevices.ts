import { ConnectionInfo, IpAddress, PlayerStatus, ServiceMessage } from '../types';
import { EventEmitter } from 'events';
import { NetworkDevice } from '.';
import { Player } from '../devices/Player';
import { sleep } from '../utils';
import { StateData, StateMap } from '../services';
import { Logger } from '../LogEmitter';

enum ConnectionStatus { CONNECTING, CONNECTED, FAILED };

interface StageLinqDevice {
  networkDevice: NetworkDevice;
};

export declare interface StageLinqDevices {
  on(event: 'trackLoaded', listener: (status: PlayerStatus) => void): this;
  on(event: 'stateChanged', listener: (status: PlayerStatus) => void): this;
  on(event: 'nowPlaying', listener: (status: PlayerStatus) => void): this;
  on(event: 'connected', listener: (connectionInfo: ConnectionInfo) => void): this;
  on(event: 'message', listener: (connectionInfo: ConnectionInfo, message: ServiceMessage<StateData>) => void): this;
}

//////////////////////////////////////////////////////////////////////////////

/**
 * Handle connecting and disconnecting from discovered devices on the
 * StageLinq network.
 */
export class StageLinqDevices extends EventEmitter {

  private discoveryStatus: Map<string, ConnectionStatus> = new Map();
  private maxRetries: number;
  private devices: Map<IpAddress, StageLinqDevice> = new Map();

  constructor(retries = 3) {
    super();
    this.maxRetries = retries;
  }

  /**
   * Attempt to connect to the player (retry if necessary).
   * @param connectionInfo Device discovered
   * @returns
   */
  async handleDevice(connectionInfo: ConnectionInfo) {
    Logger.silly(this.showDiscoveryStatus(connectionInfo));

    if (this.isConnected(connectionInfo)
      || this.isConnecting(connectionInfo)
      || this.isIgnored(connectionInfo)) return;

    this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.CONNECTING);

    // Retrying appears to be necessary because it seems the Denon hardware
    // sometimes doesn't connect. Retrying after a little wait seems to
    // solve the issue.

    let attempt = 1;

    while (attempt < this.maxRetries) {
      try {
        Logger.info(`Connecting to ${this.deviceId(connectionInfo)}. Attempt ${attempt}/${this.maxRetries}`);

        // This will fail if it doesn't connect.
        const player = await this.connectToPlayer(connectionInfo);

        Logger.info(`Successfully connected to ${this.deviceId(connectionInfo)}`);
        this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.CONNECTED);
        this.emit('connected', connectionInfo);

        player.on('trackLoaded', (status) => {
          this.emit('trackLoaded', status);
        });

        player.on('stateChanged', (status) => {
          this.emit('stateChanged', status);
        });

        player.on('nowPlaying', (status) => {
          this.emit('nowPlaying', status);
        });

        return;
      } catch(e) {
        Logger.warn(`Could not connect to ${this.deviceId(connectionInfo)} ` +
          `(${attempt}/${this.maxRetries}): ${e}`);
        attempt += 1;
        sleep(500);
      }
    }
    this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.FAILED);
    throw new Error(`Could not connect to ${this.deviceId(connectionInfo)}`);
  }

  /**
   * Disconnect from all connected devices
   */
  disconnectAll() {
    for (const device of this.devices.values()) {
      device.networkDevice.disconnect();
    }
  }

  /**
   * Connect to the player. Throw exception it can't.
   * @param device Device to connect to.
   * @returns
   */
  private async connectToPlayer(device: ConnectionInfo) {
    const networkDevice = new NetworkDevice(device);
    await networkDevice.connect();
    const stateMap = await networkDevice.connectToService(StateMap);
    if (stateMap) {
      const player = new Player({
        stateMap: stateMap,
        address: device.address,
        port: device.port
      });

      // Keep track of the devices we've connected so so we can disconnect from
      // them later.
      this.devices.set(device.address, {
        networkDevice: networkDevice,
      });

      stateMap.on('message', (data) => { this.emit('message', device, data) });
      return player;
    };
    throw new Error(`Could not connect to ${device.address}:${device.port}`);
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

  private isFailed(device: ConnectionInfo) {
    return this.discoveryStatus.get(this.deviceId(device))
      === ConnectionStatus.FAILED;
  }

  private isIgnored(device: ConnectionInfo) {
    return (
      device.software.name === 'OfflineAnalyzer'
      || device.source === 'nowplaying'
      || /^SoundSwitch/i.test(device.software.name)
      || /^Resolume/i.test(device.software.name)
      || device.software.name === 'JM08' // Ignore X1800/X1850 mixers
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