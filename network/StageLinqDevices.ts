import { ConnectionInfo, PlayerStatus, ServiceMessage, DeviceId, StageLinqOptions } from '../types';
import { EventEmitter } from 'events';
//import { Player } from '../devices/Player';
//import { sleep } from '../utils';
import { 
  FileTransfer, 
  StateData, 
  StateMap, 
  //TimeSynchronization, 
  Directory 
} from '../services';
//import { Logger } from '../LogEmitter';
import { Databases } from '../Databases';
import * as services from '../services';
import { AddressInfo } from 'net';

/*
interface StageLinqDevice {
  //networkDevice: NetworkDevice;
  fileTransferService: FileTransfer;
};
*/

export declare interface StageLinqDevices {
  on(event: 'trackLoaded', listener: (status: PlayerStatus) => void): this;
  on(event: 'stateChanged', listener: (status: PlayerStatus) => void): this;
  on(event: 'nowPlaying', listener: (status: PlayerStatus) => void): this;
  on(event: 'connected', listener: (connectionInfo: ConnectionInfo) => void): this;
  on(event: 'message', listener: (connectionInfo: ConnectionInfo, message: ServiceMessage<StateData>) => void): this;
  on(event: 'ready', listener: () => void): this;
}

//////////////////////////////////////////////////////////////////////////////

/**
 * Handle connecting and disconnecting from discovered devices on the
 * StageLinq network.
 */
export class StageLinqDevices extends EventEmitter {
  public directoryPort: number = 0;
  private services: Record<string, InstanceType<typeof services.Service>> = {};
  public readonly _services: Map<string, InstanceType<typeof services.Service>> = new Map();
  private _databases: Databases;
  public peers: Map<string, ConnectionInfo> = new Map();
  public _peers: Record<string, DeviceId> = {};
  
  protected options: StageLinqOptions;

  constructor(options: StageLinqOptions) {
    super();
    this.options = options;
    this._databases = new Databases();
  }

  /**
   * Handle incoming discovery messages from the StageLinq network
   *
   * @param connectionInfo Connection info.
   */

  async initialize(): Promise<AddressInfo> {
    
    await this.startServiceListener(StateMap);
    await this.startServiceListener(FileTransfer);
    const directory = await this.startServiceListener(Directory); //we need the server's port for announcement message

    return directory.serverInfo
  }

  async startServiceListener<T extends InstanceType<typeof services.Service>>(ctor: {
    new (parent: InstanceType<typeof StageLinqDevices>): T;
  }): Promise<T> {     
      
    const serviceName = ctor.name;
      const service = new ctor(this);

      await service.listen();
      this._services.set(serviceName, service);
      this.services[serviceName] = service;
      return service;
  }

  /**
   * Disconnect from all connected devices
   */
  async disconnectAll() {
    
    this._services.forEach(service => {
      console.info(`Closing ${service.name} server port ${service.serverInfo.port}`);
      service.closeServer();
    });
  }

  get databases() {
    return this._databases;
  }

  /*
  async downloadFile(deviceId: string, path: string) {
    const device = this.devices.get(deviceId);
    const file = await device.fileTransferService.getFile(path);
    return file;
  }
  */

  ////////////////////////////////////////////////////////////////////////////

  /**
   * Setup stateMap.
   *
   * @param connectionInfo Connection info
   * @param networkDevice Network device
   */
 
  /*
  private async setupStateMap(connectionInfo: ConnectionInfo, networkDevice: NetworkDevice) {
    // Setup StateMap
    Logger.debug(`Setting up stateMap for ${connectionInfo.address}`);

    const stateMap = await networkDevice.connectToService(StateMap);
    stateMap.on('message', (data) => {
      this.emit('message', connectionInfo, data)
    });

    // Setup Player
    const player = new Player({
      stateMap: stateMap,
      address: connectionInfo.address,
      port: connectionInfo.port,
      deviceId: this.sourceId(connectionInfo)
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
      device.source === this.options.actingAs.source
      || device.software.name === 'OfflineAnalyzer'
      || /^SoundSwitch/i.test(device.software.name)
      || /^Resolume/i.test(device.software.name)
      || device.software.name === 'JM08' // Ignore X1800/X1850 mixers
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
*/
}