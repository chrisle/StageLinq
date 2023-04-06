import { Discovery } from '../network';
import { EventEmitter } from 'events';
import { Logger } from '../LogEmitter';
import { ActingAsDevice, StageLinqOptions } from '../types';
import { Devices } from '../devices'
import { Sources } from '../Sources';
import * as Services from '../services';
import { Status } from '../status/Status';
import { AddressInfo, Server } from 'net';


const DEFAULT_OPTIONS: StageLinqOptions = {
  maxRetries: 3,
  actingAs: ActingAsDevice.StageLinqJS,
  downloadDbSources: true,
};

interface ServiceHandlers {
  [key: string]: InstanceType<typeof Services.ServiceHandler>;
}



/**
 * Main StageLinq class.
 */
export class StageLinq extends EventEmitter {

  public options: StageLinqOptions;
  #services: ServiceHandlers = {};

  public readonly devices = new Devices();
  public readonly logger: Logger = Logger.instance;
  public readonly discovery: Discovery = new Discovery(this);

  public readonly stateMap: Services.StateMapHandler = null;
  public readonly fileTransfer: Services.FileTransferHandler = null;
  public readonly beatInfo: Services.BeatInfoHandler = null;
  //public readonly timeSync: Services.TimeSynchronizationHandler = null;
  public static FileTransfer: Services.FileTransfer

  public readonly sources: Sources = null;
  public readonly status: Status = null;

  private directory: Services.Directory = null;
  private servers: Map<string, Server> = new Map();

  /**
   * Main StageLinq Class
   * @constructor
   * @param {StageLinqOptions} [options]
   */
  constructor(options?: StageLinqOptions) {
    super();
    this.options = options || DEFAULT_OPTIONS;
    this.sources = new Sources(this);
    this.status = new Status(this);

    //TODO make this into factory function?
    for (let service of this.options.services) {
      switch (service) {
        case "StateMap": {
          this.stateMap = new Services.StateMapHandler(this, service);
          break;
        }
        case "FileTransfer": {
          this.fileTransfer = new Services.FileTransferHandler(this, service);
          break;
        }
        case "BeatInfo": {
          this.beatInfo = new Services.BeatInfoHandler(this, service);
          break;
        }
        case "TimeSynchronization": {
          new Services.TimeSynchronizationHandler(this, service);
          break;
        }
        default:
          break;
      }
    }
  }

  get services() {
    return this.#services
  }

  get timeSync() {
    return this.#services['TimeSynchronization'] as Services.TimeSynchronizationHandler || null
  }

  addService(serviceHandler: InstanceType<typeof Services.ServiceHandler>) {
    this.#services[serviceHandler.name] = serviceHandler;
  }

  /**
   * 
   * @param {string} serverName 
   * @param {Server} server 
   */
  addServer(serverName: string, server: Server) {
    this.servers.set(serverName, server);
  }

  /**
   * 
   * @param {string} serverName 
   */
  deleteServer(serverName: string) {
    this.servers.delete(serverName);
  }

  /**
   * 
   * @returns {IterableIterator<[string, Server]>}
   */
  private getServers() {
    return this.servers.entries();
  }

  /**
   * Connect to the StageLinq network.
   */
  async connect() {
    //  Initialize Discovery agent
    await this.discovery.listen(this.options.actingAs);

    //Directory is required
    const directory = new Services.DirectoryHandler(this, Services.Directory.name)
    this.directory = await directory.startServiceListener(Services.Directory, this);

    //  Announce myself with Directory port
    await this.discovery.announce(this.directory.serverInfo.port);
  }

  /**
   * Disconnect from the StageLinq network.
   * Close all open Servers
   */
  async disconnect() {
    try {
      Logger.warn('disconnecting');
      const servers = this.getServers();
      for (let [serviceName, server] of servers) {
        const addressInfo = server.address() as AddressInfo;
        console.log(`Closing ${serviceName} server port ${addressInfo.port}`);
        await server.close;
      }
      await this.discovery.unannounce();
    } catch (e) {
      throw new Error(e);
    }
  }
}