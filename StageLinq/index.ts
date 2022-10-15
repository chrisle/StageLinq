import { Discovery } from '../network';
import { Player } from '../devices/Player';
import { EventEmitter } from 'events';
import { Logger } from '../LogEmitter';
import { ActingAsDevice, StageLinqOptions, DeviceId, ConnectionInfo, ServiceMessage, PlayerStatus} from '../types';
import {
  FileTransfer,
  StateData,
  StateMap,
  //TimeSynchronization,
  Directory,
} from '../services';

import { Databases } from '../Databases';
import * as services from '../services';
import { Socket } from 'net';
import { assert } from 'console';
import { sleep } from '../utils';


const DEFAULT_OPTIONS: StageLinqOptions = {
  maxRetries: 3,
  actingAs: ActingAsDevice.NowPlaying,
  downloadDbSources: true,
};

export declare interface StageLinq {
  on(event: 'trackLoaded', listener: (status: PlayerStatus) => void): this;
  on(event: 'stateChanged', listener: (status: PlayerStatus) => void): this;
  on(event: 'nowPlaying', listener: (status: PlayerStatus) => void): this;
  on(event: 'connected', listener: (connectionInfo: ConnectionInfo) => void): this;
  on(event: 'newStateMapDevice', listener: (deviceId: DeviceId, socket: Socket) => void): this;
  on(event: 'message', listener: ( message: ServiceMessage<StateData>) => void): this;
  on(event: 'ready', listener: () => void): this;
}

/**
 * Main StageLinq class.
 */
export class StageLinq extends EventEmitter {
  
  public logger: Logger = Logger.instance;
  
  public directoryPort: number = 0;
  private services: Record<string, InstanceType<typeof services.Service>> = {};
  public readonly _services: Map<string, InstanceType<typeof services.Service>> = new Map();
  private _databases: Databases;
  //public peers: Map<string, ConnectionInfo> = new Map();
  //public _peers: Record<string, DeviceId> = {};

  public options: StageLinqOptions;

  public discovery: Discovery;

  constructor(options?: StageLinqOptions) {
    super();
    this.options = options || DEFAULT_OPTIONS;
    this._databases = new Databases();
  }

  /**
   * Connect to the StageLinq network.
   */
  async connect() {
    this.discovery = new Discovery();
    await this.discovery.init();
    
    
    //set up seriveces 
    //await this.setupFileTransfer();
    await this.setupStateMap();
    const directory = await this.startServiceListener(Directory); // We need the server's port for announcement message.

    await this.discovery.announce(directory.serverInfo.port);
  }

  /**
   * Disconnect from the StageLinq network.
   */
  async disconnect() {
    try {
      Logger.warn('disconnecting');
      this._services.forEach((service) => {
        console.info(`Closing ${service.name} server port ${service.serverInfo.port}`);
        service.closeServer();
      });
      
      //const msg = await this.discovery.createDiscoveryMessage(Action.Logout, this.options.actingAs);
      await this.discovery.unannounce();
    } catch (e) {
      throw new Error(e);
    }
  }


  async startServiceListener<T extends InstanceType<typeof services.Service>>(ctor: {
    new (parent: InstanceType<typeof StageLinq>): T;
  }): Promise<T> {
    const serviceName = ctor.name;
    const service = new ctor(this);

    await service.listen();
    this._services.set(serviceName, service);
    this.services[serviceName] = service;
    return service;
  }


  private async setupFileTransfer() {
    const fileTransfer = await this.startServiceListener(FileTransfer);

    fileTransfer.on('dbDownloaded', (sourcename, dbPath) => {
      Logger.debug(`received ${sourcename} ${dbPath}`);
      //testDownloadFile(this);
    });
  }

  
  private async setupStateMap() {
    // Setup StateMap
    //Logger.debug(`Setting up stateMap for ${connectionInfo.address}`);

    const stateMap = await this.startServiceListener(StateMap);

    stateMap.on('message', (data) => {
      this.emit('message', data)
    });

    // Setup Player
   await stateMap.on('newStateMapDevice',  (deviceId, socket) => {
    const player = new Player({
      stateMap: stateMap,
      address: socket.remoteAddress,
      port: socket.remotePort,
      deviceId: deviceId.toString(),
    });

    //wait for Player to setup
    while (!player.ready) {
      sleep(250);
    }

    stateMap.subscribe(socket);

    player.on('trackLoaded', (status) => {
      this.emit('trackLoaded', status);
    });

    player.on('stateChanged', (status) => {
      this.emit('stateChanged', status);
    });

    player.on('nowPlaying', (status) => {
      this.emit('nowPlaying', status);
    });
   })
  }


  get databases() {
    return this._databases;
  }
  

  async downloadFile(_deviceId: string, path: string) {
    const service = this.services["FileTransfer"] as FileTransfer
    assert(service);
    const deviceId = new DeviceId(_deviceId);
    
    //Logger.debug(service.peerSockets.entries());
    const socket = service._peerSockets[deviceId.toString()];
    //Logger.debug(socket);
    
    //const file = await service.getFile(`net://${deviceId}${path}`,socket)
    const file = await service.getFile(path,socket);
    return file;
  } 
}

/*
async function testDownloadFile(stageLinq: InstanceType<typeof StageLinq>) {
  const trackNetworkPath = '/HONUSZ (USB 1)/Contents/Space Food/Stay In/14786650_Dark Force_(Original Mix).mp3'
  const deviceId = new DeviceId('4be14112-5ead-4848-a07d-b37ca8a7220e')      
  const fileName = trackNetworkPath.split('/').pop();       
  const buff = stageLinq.downloadFile(deviceId.toString(), trackNetworkPath)
}
*/