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
import * as Services from '../services';
import { Socket } from 'net';
import { assert } from 'console';
import { sleep } from '../utils';


const DEFAULT_OPTIONS: StageLinqOptions = {
  maxRetries: 3,
  actingAs: ActingAsDevice.NowPlaying,
  downloadDbSources: true,
};

type DeviceService = Map<string, InstanceType<typeof Services.Service>>

export interface DeviceServices {
  [key: string]: DeviceService;
}

type DeviceSocket = Map<string, Socket>

export interface DeviceSockets {
  [key: string]: DeviceSocket;
}

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
  
  //public directoryPort: number = 0;
 // private _services: Record<string, InstanceType<typeof Services.Service>> = {};
  //public ipAddressPorts: 
  public sockets: DeviceSockets = {};
  public services: DeviceServices = {};
  public serviceList: string[] = [];
  public readonly _services: Map<string, InstanceType<typeof Services.Service>> = new Map();
  private _databases: Databases;

  public options: StageLinqOptions;

  public discovery: Discovery = new Discovery;

  constructor(options?: StageLinqOptions) {
    super();
    this.options = options || DEFAULT_OPTIONS;
    this._databases = new Databases(this);
  }

  /**
   * Connect to the StageLinq network.
   */
  async connect() {
    //  Initialize Discovery agent
    await this.discovery.init(this.options.actingAs);
    
    //  Set up services 
    //await this.setupFileTransfer();
    //await this.setupStateMap();
    this.serviceList = [
      FileTransfer.name, 
      StateMap.name,
    ]
    const directory = await this.startServiceListener(Directory); // We need the server's port for announcement message.

    //  Announce myself with Directory port
    await this.discovery.announce(directory.serverInfo.port);

    await sleep(10000);
   
    this._databases.downloadDb('4be14112-5ead-4848-a07d-b37ca8a7220e')
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
      
      await this.discovery.unannounce();
    } catch (e) {
      throw new Error(e);
    }
  }


  async startServiceListener<T extends InstanceType<typeof Services.Service>>(ctor: {
    new (parent: InstanceType<typeof StageLinq>): T;
  }): Promise<T> {
    const serviceName = ctor.name;
    const service = new ctor(this);

    await service.listen();
    if (service.name == 'StateMap' ) {
      this.setupStateMap(service)
    }
    if (service.name == 'FileTransfer' ) {
      this.setupFileTransfer(service)
    }
    //service.on('message', message => {
    //  this.emit('message', message);
    //})
    this._services.set(serviceName, service);
    //this.services[serviceName] = service;
   //this.serviceList.push(serviceName);
    return service;
  }


  private async setupFileTransfer(service: InstanceType<typeof Services.Service>) {
    const fileTransfer = service as Services.FileTransfer;

    fileTransfer.on('dbDownloaded', (sourcename, dbPath) => {
      Logger.debug(`received ${sourcename} ${dbPath}`);
      //testDownloadFile(this);
    });
  }

  
  private async setupStateMap(service: InstanceType<typeof Services.Service>) {
    // Setup StateMap
    const stateMap = service as Services.StateMap;

    //const stateMap = await this.startServiceListener(StateMap);

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
    const service = this._services.get("FileTransfer") as FileTransfer
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