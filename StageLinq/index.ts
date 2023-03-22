import { Discovery } from '../network';
import { EventEmitter } from 'events';
import { Logger } from '../LogEmitter';
import { ActingAsDevice, StageLinqOptions, Devices, DeviceId, ConnectionInfo, ServiceMessage, Source} from '../types';
import { Databases, Sources } from '../Databases';
import * as Services from '../services';
import { Server } from 'net';
import { assert } from 'console';

const DEFAULT_OPTIONS: StageLinqOptions = {
  maxRetries: 3,
  actingAs: ActingAsDevice.NowPlaying,
  downloadDbSources: true,
};

export interface ServiceHandlers {
  [key: string]: InstanceType<typeof Services.ServiceHandler>;
}

export declare interface StageLinq {
  
  on(event: 'connected', listener: (connectionInfo: ConnectionInfo) => void): this;
  on(event: 'newStateMapDevice', listener: (deviceId: DeviceId, service: InstanceType<typeof Services.StateMap>) => void): this;
  on(event: 'stateMessage', listener: ( message: ServiceMessage<Services.StateData>) => void): this;
  on(event: 'ready', listener: () => void): this;
  on(event: 'connection', listener: (serviceName: string, deviceId: DeviceId) => void): this;
  on(event: 'fileProgress', listener: (path: string, total: number, bytesDownloaded: number, percentComplete: number) => void): this;
}

/**
 * Main StageLinq class.
 */
export class StageLinq extends EventEmitter {

  public options: StageLinqOptions;
  public services: ServiceHandlers = {};
  
  public readonly devices = new Devices();
  public readonly logger: Logger = Logger.instance;
  public readonly discovery: Discovery = new Discovery(this);
  
  public readonly stateMap: InstanceType<typeof Services.StateMapHandler> = null;
  public readonly fileTransfer: InstanceType<typeof Services.FileTransferHandler> = null;
  public readonly beatInfo: InstanceType<typeof Services.BeatInfoHandler> = null;
  public readonly timeSync: InstanceType<typeof Services.TimeSynchronizationHandler> = null;

  private directory: InstanceType<typeof Services.Directory> = null;
  private _databases: Databases;
  private _sources: Sources;
  private servers: Map<string, Server> = new Map();
 
  constructor(options?: StageLinqOptions) {
    super();
    this.options = options || DEFAULT_OPTIONS;
    this._databases = new Databases(this);
    this._sources = new Sources(this);
    
    //TODO make this into factory function?
    for (let service of this.options.services) {  
      switch (service) {
        case "StateMap": {
          const stateMap = new Services.StateMapHandler(this, service);
          this.services[service] = stateMap
          this.stateMap = stateMap
          break;
        }
        case "FileTransfer": {
          const fileTransfer = new Services.FileTransferHandler(this, service);
          this.services[service] = fileTransfer;
          this.fileTransfer = fileTransfer;
          break;
        }
        case "BeatInfo": {
          const beatInfo = new Services.BeatInfoHandler(this, service);
          this.services[service] = beatInfo;
          this.beatInfo = beatInfo;
          break;
        }
        case "TimeSynchronization": {
          const timeSync = new Services.TimeSynchronizationHandler(this, service);
          this.services[service] = timeSync;
          this.timeSync = timeSync;
          break;
        }
        default:
        break;
      }
    }
  }

  ////// Getters & Setters /////////
  get databases() {
    return this._databases;
  }

  get sources() {
    return this._sources
  }

  addServer(serverName: string , server: Server) {
    this.servers.set(serverName, server);
  }

  deleteServer(serverName: string) {
    this.servers.delete(serverName);
  }

  private getServers() {
    return this.servers.entries();
  }

  /**
   * Connect to the StageLinq network.
   */
  async connect() {
    //  Initialize Discovery agent
    await this.discovery.init(this.options.actingAs);
  
    //Directory is required
    const directory = new Services.DirectoryHandler(this, Services.Directory.name)
    this.services[Services.Directory.name] = directory;
    this.directory = await directory.startServiceListener(Services.Directory, this);
    
    //  Announce myself with Directory port
    await this.discovery.announce(this.directory.serverInfo.port);   
  }

  /**
   * Disconnect from the StageLinq network.
   */
  async disconnect() {
    try {
      Logger.warn('disconnecting');
      const servers = this.getServers();
      for (let [serviceName, server] of servers) {
        Logger.debug(`Closing ${serviceName} server port ${server.address()}`)
        server.close;
      }      
      await this.discovery.unannounce();
    } catch (e) {
      throw new Error(e);
    }
  }

  async downloadFile(source: Source, path: string): Promise<Uint8Array> {
   
    const service = source.service;
    assert(service);
    await service.isAvailable();

    try {
      const file = await service.getFile(path,service.socket);
      return file;
    } catch (err) {
      Logger.error(err);
      throw new Error(err);
    }
  } 
}