import { Discovery } from '../network';
import { Player } from '../devices/Player';
import { EventEmitter } from 'events';
import { Logger } from '../LogEmitter';
import { ActingAsDevice, StageLinqOptions, Devices, DeviceId, ConnectionInfo, ServiceMessage, PlayerStatus} from '../types';
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
/*
export interface Devices {
  [key: string]: {
    info: ConnectionInfo;
    service?: DeviceService;
    socket?: DeviceSocket;
  }
}
*/
export declare interface StageLinq {
  on(event: 'trackLoaded', listener: (status: PlayerStatus) => void): this;
  on(event: 'stateChanged', listener: (status: PlayerStatus) => void): this;
  on(event: 'nowPlaying', listener: (status: PlayerStatus) => void): this;
  on(event: 'connected', listener: (connectionInfo: ConnectionInfo) => void): this;
  on(event: 'newStateMapDevice', listener: (deviceId: DeviceId, socket: Socket) => void): this;
  on(event: 'message', listener: ( message: ServiceMessage<Services.StateData>) => void): this;
  on(event: 'ready', listener: () => void): this;

  //on(event: 'fileDownloaded', listener: (sourceName: string, dbPath: string) => void): this;
  //on(event: 'fileDownloading', listener: (sourceName: string, dbPath: string) => void): this;
  on(event: 'fileProgress', listener: (path: string, total: number, bytesDownloaded: number, percentComplete: number) => void): this;
}

/**
 * Main StageLinq class.
 */
export class StageLinq extends EventEmitter {

  public sockets: DeviceSockets = {};
  public services: DeviceServices = {};
  public serviceList: string[] = [];
  public readonly _services: Map<string, InstanceType<typeof Services.Service>> = new Map();
  private _databases: Databases;
  public devices = new Devices();

  public options: StageLinqOptions;

  public logger: Logger = Logger.instance;
  public discovery: Discovery = new Discovery(this);

  constructor(options?: StageLinqOptions) {
    super();
    this.options = options || DEFAULT_OPTIONS;
    this._databases = new Databases(this);
  }

  ////// Getters & Setters /////////
  get databases() {
    return this._databases;
  }
  /*
  setInfo(deviceId: DeviceId, info: ConnectionInfo) {
    this.devices[deviceId.toString()].info = info;
  } 

  getService(deviceId: DeviceId, serviceName: string) {
    return this.devices[deviceId.toString()].service.get(serviceName);
  } 

  setService(deviceId: DeviceId, serviceName: string, service: InstanceType<typeof Services.Service>) {
    this.devices[deviceId.toString()].service.set(serviceName, service);
  } 

  getSocket(deviceId: DeviceId, serviceName: string) {
    return this.devices[deviceId.toString()].socket.get(serviceName);
  } 
  
  setSocket(deviceId: DeviceId, serviceName: string, socket: Socket) {
    this.devices[deviceId.toString()].socket.set(serviceName, socket);
  } 
*/
  /**
   * Connect to the StageLinq network.
   */
  async connect() {
    //  Initialize Discovery agent
    await this.discovery.init(this.options.actingAs);
    
    //  Select Services to offer
    this.serviceList = [
      Services.FileTransfer.name, 
      Services.StateMap.name,
    ];

    //  Directory is required
    const directory = await this.startServiceListener(Services.Directory);

    //  Announce myself with Directory port
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
      
      await this.discovery.unannounce();
    } catch (e) {
      throw new Error(e);
    }
  }


  async startServiceListener<T extends InstanceType<typeof Services.Service>>(ctor: {
    new (parent: InstanceType<typeof StageLinq>, _deviceId?: DeviceId): T;
  }, deviceId?: DeviceId): Promise<T> {
    const serviceName = ctor.name;
    const service = new ctor(this, deviceId);
    
    await service.listen();
    if (service.name == 'StateMap' ) {
      this.setupStateMap(service)
    }
    if (service.name == 'FileTransfer' ) {
      this.setupFileTransfer(service)
    }
    this._services.set(serviceName, service);
    return service;
  }


  private async setupFileTransfer(service: InstanceType<typeof Services.Service>) {
    // const fileTransfer = service as Services.FileTransfer;

    Logger.silly(`Set up Service ${service.name}`);
    // fileTransfer.on('dbDownloaded', (sourcename, dbPath) => {
    //   Logger.debug(`received ${sourcename} ${dbPath}`);
    //   //testDownloadFile(this);
    // });
  }
  
  
  private async setupStateMap(service: InstanceType<typeof Services.Service>) {
    // Setup StateMap
    const stateMap = service as Services.StateMap;

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


  async downloadFile(_deviceId: string, path: string) {
    
    const deviceId = new DeviceId(_deviceId);
    const service = this.services[deviceId.toString()].get('FileTransfer') as Services.FileTransfer;
    assert(service);

    const socket = this.sockets[deviceId.toString()].get('FileTransfer');
    assert(socket);

    
    
    await service.isAvailable();
    
    let thisTxid = service.txid;

    service.on('fileTransferProgress', (txid, progress) => {
      //Logger.warn(thisTxid, txid);
      if (thisTxid === txid) {
        this.emit('fileProgress', path.split('/').pop(), progress.total, progress.bytesDownloaded, progress.percentComplete);
        //Logger.debug('fileProgress', path.split('/').pop(), progress.total, progress.bytesDownloaded, progress.percentComplete);
      }
    });

    try {
      const file = await service.getFile(path,socket);
      return file;
    } catch (err) {
      Logger.error(err);
      throw new Error(err);
    }
  } 
}