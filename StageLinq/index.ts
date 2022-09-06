import { announce, StageLinqListener, unannounce } from '../network';
import { PlayerStatus } from '../types';
import { EventEmitter } from 'events';
import { StageLinqDevices } from '../network/StageLinqDevices';
import { Logger } from '../LogEmitter';

export declare interface StageLinq {
  on(event: 'trackLoaded', listener: (status: PlayerStatus) => void): this;
  on(event: 'stateChanged', listener: (status: PlayerStatus) => void): this;
  on(event: 'nowPlaying', listener: (status: PlayerStatus) => void): this;
  on(event: 'connected', listener: () => void): this;
}

/**
 * Main StageLinq class.
 */
export class StageLinq extends EventEmitter {

  devices: StageLinqDevices = new StageLinqDevices();
  logger: Logger = Logger.instance;

  private listener: StageLinqListener = new StageLinqListener();

  /**
   * Connect to the StageLinq network.
   */
  async connect() {
    await announce();
    this.listener.listenForDevices(async (connectionInfo) => {
      await this.devices.handleDevice(connectionInfo);
    });
  }

  /**
   * Disconnect from the StageLinq network.
   */
  async disconnect() {
    try {
      this.devices.disconnectAll();
      await unannounce();
    } catch(e) {
      throw new Error(e);
    }
  }

}