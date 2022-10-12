import { announce, createDiscoveryMessage, StageLinqListener, unannounce } from '../network';
import { EventEmitter } from 'events';
import { StageLinqDevices } from '../network/StageLinqDevices';
import { Logger } from '../LogEmitter';
import { Action, ActingAsDevice, StageLinqOptions, DeviceId } from '../types';
//import { sleep } from '../utils';

const DEFAULT_OPTIONS: StageLinqOptions = {
  maxRetries: 3,
  actingAs: ActingAsDevice.NowPlaying,
  downloadDbSources: true
};

/**
 * Main StageLinq class.
 */
export class StageLinq extends EventEmitter {

  devices: StageLinqDevices;
  logger: Logger = Logger.instance;
  options: StageLinqOptions;

  private listener: StageLinqListener;

  constructor(options?: StageLinqOptions) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.devices = new StageLinqDevices(this.options);
  }

  /**
   * Connect to the StageLinq network.
   */
  async connect() {
    this.listener = new StageLinqListener();
    const address = await this.devices.initialize();
    const msg = createDiscoveryMessage(Action.Login, this.options.actingAs);
    
    msg.port = address.port;
    await announce(msg);
    this.listener.listenForDevices(async (connectionInfo) => {
      
      const deviceId = new DeviceId(connectionInfo.token);
      this.devices._peers[connectionInfo.address] = deviceId;

      if (!this.devices.peers.has(deviceId.toString()) || this.devices.peers.get(deviceId.toString()).port !== connectionInfo.port) {
        this.devices.peers.set(deviceId.toString(), connectionInfo);
      }
    });
  }

  /**
   * Disconnect from the StageLinq network.
   */
  async disconnect() {
    try {
      Logger.warn('disconnecting');
      this.devices.disconnectAll();
      const msg = createDiscoveryMessage(Action.Logout, this.options.actingAs)
      await unannounce(msg);
    } catch(e) {
      throw new Error(e);
    }
  }

  get databases() {
    return this.devices.databases;
  }

}