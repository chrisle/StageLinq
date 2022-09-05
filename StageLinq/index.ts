import { announce, StageLinqListener, unannounce } from '../network';
import { PlayerStatus } from '../types';
import { EventEmitter } from 'events';
import { StageLinqDevices } from '../network/StageLinqDevices';
import { Logger } from '../utils/Logger';

export declare interface StageLinq {
  on(event: 'trackLoaded', listener: (status: PlayerStatus) => void): this;
  on(event: 'stateChanged', listener: (status: PlayerStatus) => void): this;
  on(event: 'nowPlaying', listener: (status: PlayerStatus) => void): this;
  on(event: 'connected', listener: () => void): this;
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

  private listener: StageLinqListener = new StageLinqListener();
  private devices: StageLinqDevices = new StageLinqDevices();

  /**
   * Connect to the StageLinq network.
   */
  async connect() {
    await announce();

    this.listener.listenForDevices(async (connectionInfo) => {
      await this.devices.handleDevice(connectionInfo);
    });

    this.devices.on('trackLoaded', (state) => {
      Logger.log(state);
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