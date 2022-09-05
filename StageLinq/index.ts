import { announce, StageLinqListener, NetworkDevice, unannounce } from '../network';
import { ConnectionInfo, IpAddress, PlayerStatus } from '../types';
import { EventEmitter } from 'events';
import { Player } from '../devices/Player';
import { sleep } from '../utils';
import { StateMap } from '../services';

interface StageLinqConnectionOptions {
  maxRetries?: number;
}

interface StageLinqDevice {
  networkDevice: NetworkDevice;
};

export declare interface StageLinq {
  on(event: 'trackLoaded', listener: (status: PlayerStatus) => void): this;
  on(event: 'stateChanged', listener: (status: PlayerStatus) => void): this;
  on(event: 'nowPlaying', listener: (status: PlayerStatus) => void): this;
}

/**
 * Main StageLinq class.
 *
 * Example:
 *
 * import { StageLinq } from 'StageLinq';
 * const stageLinq = new StageLinq();
 * stageLinq.on('trackLoaded', (status) => { console.log(status); });
 * stageLinq.on('stateChanged', (status) => { console.log(status); });
 * stageLinq.on('stateChanged', (status) => {
 *   console.log(`Playing on [${status.deck}]: ${status.title} - ${status.artist}`);
 * });
 */
export class StageLinq extends EventEmitter {

  devices: Map<IpAddress, StageLinqDevice> = new Map();

  private _maxRetries: number = 3;
  private _listener: StageLinqListener;

  constructor(options?: StageLinqConnectionOptions) {
    super();
    if (options && options.maxRetries) this._maxRetries = options.maxRetries;
  }

  /**
   * Connect to the StageLinq network.
   */
  async connect() {
    await announce();
    this._listener = new StageLinqListener();
    this._listener.onDeviceDiscovered(this.onDeviceDiscovered.bind(this));
  }

  /**
   * Disconnect from the StageLinq network.
   */
  async disconnect() {
    try {
      // Disconnect from all devices we've connected to.
      for (const device of this.devices.values()) {
        device.networkDevice.disconnect();
      }
      // Stop announcing.
      await unannounce();
    } catch(e) {
      throw new Error(e);
    }
  }

  /**
   * Attempt to connect to the player (retry if necessary).
   * @param device Device discovered
   * @returns
   */
  private async onDeviceDiscovered(device: ConnectionInfo) {
    let retry = 0;
    let error = '';
    const addressPort = `${device.address}:${device.port}`;

    // Retrying appears to be necessary because it seems the Denon hardware
    // refueses to connect. Retrying after a little bit of time seems to
    // solve the issue.
    while (retry < this._maxRetries) {
      retry += 1;
      try {
        console.log(`Connecting to ${device.software.name} on ${addressPort}`);
        const player = await this.connectToPlayer(device);
        console.log(`Successfully connected to ${addressPort}`);

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
        sleep(500);
        console.warn(`Could not connect to ${addressPort} (${retry}/${this._maxRetries}): ${e}`);
        error = e;
      }
    }
    throw new Error(`Failed to connect to ${addressPort}: ${error}`);
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
      return player;
    };
    throw new Error(`Could not connect to ${device.address}:${device.port}`);
  }

}