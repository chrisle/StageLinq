import { announce, StageLinqListener, unannounce } from '../network';
import { EventEmitter } from 'events';
import { StageLinqDevices } from '../network/StageLinqDevices';
import { Logger } from '../LogEmitter';
import { StageLinqOptions } from '../types';

const DEFAULT_OPTIONS: StageLinqOptions = {
  downloadDatabase: true,
  useDatabases: true,
  maxRetries: 3
};

/**
 * Main StageLinq class.
 */
export class StageLinq extends EventEmitter {

  devices: StageLinqDevices;
  logger: Logger = Logger.instance;
  options: StageLinqOptions;

  private listener: StageLinqListener = new StageLinqListener();

  constructor(options?: StageLinqOptions) {
    super();
    if (options) this.options = { ...DEFAULT_OPTIONS, ...options };
    this.devices = new StageLinqDevices(this.options);
  }

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

  get databases() {
    return this.devices.databases;
  }

}