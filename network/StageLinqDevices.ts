import { ConnectionInfo, IpAddress, PlayerStatus, ServiceMessage, Services, StageLinqOptions } from '../types';
import { EventEmitter } from 'events';
//import { NetworkDevice } from '.';
import { Player } from '../devices/Player';
import { sleep } from '../utils';
import { Directory, FileTransfer, StateData, StateMap, TimeSynchronization } from '../services';
import { Logger } from '../LogEmitter';
import { Databases } from '../Databases';
import * as services from '../services';
import { AddressInfo } from 'net';
import { dir } from 'console';

//enum ConnectionStatus { CONNECTING, CONNECTED, FAILED };

interface StageLinqDevice {
  //networkDevice: NetworkDevice;
  fileTransferService: FileTransfer;
};

export interface ServiceInitMessage {
  parent: InstanceType<typeof StageLinqDevices>;
  services?: Map<string,number>;
}

// This time needs to be just long enough for discovery messages from all to
// come through.
const WAIT_FOR_DEVICES_TIMEOUT_MS = 3000;

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
  private _services: Map<string, InstanceType<typeof services.Service>> = new Map();
  private _databases: Databases;
  public peers: Map<string, ConnectionInfo> = new Map();
  private devices: Map<IpAddress, StageLinqDevice> = new Map();
  //private services2: Map<string, InstanceType<typeof services.Service>> = new Map();
  //private discoveryStatus: Map<string, ConnectionStatus> = new Map();
  private options: StageLinqOptions;

  //private deviceWatchTimeout: NodeJS.Timeout | null = null;
  //private stateMapCallback: { connectionInfo: ConnectionInfo, networkDevice: NetworkDevice }[] = [];

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
    let initMsg: ServiceInitMessage = {
      parent: this,
    }

    initMsg.services = new Map();
    //const timeSync = new TimeSynchronization(initMsg);
    //const timeSyncInfo = await timeSync.listen();
    //initMsg.services.set('TimeSynchronization', timeSyncInfo.port);
    
    //await this.startServiceListener(TimeSynchronization);

    if (this.options.services.includes(Services.StateMap)) {
      const stateMap = new StateMap(initMsg);
      const stateMapInfo = await stateMap.listen();
      initMsg.services.set('StateMap', stateMapInfo.port);
      this.services[StateMap.name] = stateMap;
      this._services.set(StateMap.name, stateMap);
    }

    if (this.options.services.includes(Services.FileTransfer)) {
      const fileTransfer = new FileTransfer(initMsg);
      const FileTransferInfo = await fileTransfer.listen();
      initMsg.services.set('FileTransfer', FileTransferInfo.port);
      this.services[FileTransfer.name] = fileTransfer;
      this._services.set(FileTransfer.name, fileTransfer);
    }
   
    const directory = new Directory(initMsg);
    const directoryInfo = await directory.listen();
    initMsg.services.set('DirectoryService', directoryInfo.port);
    this.directoryPort = directoryInfo.port;
    this.services[Directory.name] = directory;
    this._services.set(Directory.name, directory);
    
    return directoryInfo
  }
/*
   // Factory function
   async startServiceListener<T extends InstanceType<typeof services.Service>>(ctor: {
    new (p_initMsg:ServiceInitMessage): T;
    }): Promise<T> {
    //assert(this.connection);
    // FIXME: find out why we need these waits before connecting to a service
    //await sleep(500);

    const serviceName = ctor.name;

    if (this.services[serviceName]) {
      return this.services[serviceName] as T;
    }

    //assert(this.servicePorts.hasOwnProperty(serviceName));
    //assert(this.servicePorts[serviceName] > 0);
    //const port = this.servicePorts[serviceName];

    const service = new ctor();

    await service.listen();
    //service.on('listening', (serverInfo) =>{
    //  this.directoryPort = serverInfo.port;
    this.services[serviceName] = service;
    //});
    return service;
   
  }
  */

  /**
   * Disconnect from all connected devices
   */
  async disconnectAll() {
    //for (const device of this.devices.values()) {
    //  device.networkDevice.disconnect();
    //}
    //console.info('closing servers')
    this._services.forEach(service => {
      console.info(`Closing ${service.name} server port ${service.serverInfo.port}`);
      service.server.close();
    })

    //const stateMap = this.services[StateMap.name];
    //const directory = this.services[Directory.name];
    //this.services
    //await stateMap.server.close();
    //await directory.server.close();
    
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