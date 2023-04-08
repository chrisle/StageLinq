import { Discovery } from '../network';
import { Logger } from '../LogEmitter';
import { ActingAsDevice, StageLinqOptions } from '../types';
import { Devices, DeviceId } from '../devices'
import { Sources } from '../Sources';
import { Service, Directory } from '../services';
import { Status } from '../status/Status';
import { AddressInfo, Server } from 'net';


const DEFAULT_OPTIONS: StageLinqOptions = {
  actingAs: ActingAsDevice.StageLinqJS,
  downloadDbSources: true,
};

/**
 * Main StageLinq class.
 */
export class StageLinq {
  static options: StageLinqOptions;
  static readonly devices = new Devices();
  static readonly discovery: Discovery = new Discovery();
  static readonly sources: Sources = new Sources();;
  static readonly status: Status = new Status();
  static directory: Directory = null;
  static servers: Map<string, Server> = new Map();

  public readonly logger: Logger = Logger.instance;

  /**
   * Main StageLinq Class
   * @constructor
   * @param {StageLinqOptions} [options]
   */
  constructor(options?: StageLinqOptions) {
    StageLinq.options = options || DEFAULT_OPTIONS;
  }

  /**
   * Service Constructor Factory Function
   * @param {Service<T>} Service
   * @param {DeviceId} deviceId 
   * @returns {Promise<Service<T>>}
   */
  static async startServiceListener<T extends InstanceType<typeof Service>>(ctor: {
    new(_deviceId?: DeviceId): T;
  }, deviceId?: DeviceId): Promise<T> {
    const service = new ctor(deviceId);
    await service.start();
    return service;
  }

  /**
   * Add a Server to the Server Register
   * @param {string} serverName 
   * @param {Server} server 
   */
  static addServer(serverName: string, server: Server) {
    StageLinq.servers.set(serverName, server);
  }

  /**
   * Remove a Server from the Server Register
   * @param {string} serverName 
   */
  static deleteServer(serverName: string) {
    StageLinq.servers.delete(serverName);
  }

  /**
   * Get All Servers
   * @returns {IterableIterator<[string, Server]>}
   */
  private static getServers() {
    return StageLinq.servers.entries();
  }

  /**
   * Connect to the StageLinq network.
   */
  async connect() {
    //  Initialize Discovery agent
    await StageLinq.discovery.listen(StageLinq.options.actingAs);

    //Directory is required
    StageLinq.directory = await StageLinq.startServiceListener(Directory);

    //  Announce myself with Directory port
    await StageLinq.discovery.announce(StageLinq.directory.serverInfo.port);
  }

  /**
   * Disconnect from the StageLinq network.
   * Close all open Servers
   */
  async disconnect() {
    try {
      Logger.warn('disconnecting');
      const servers = StageLinq.getServers();
      for (let [serviceName, server] of servers) {
        const addressInfo = server.address() as AddressInfo;
        console.log(`Closing ${serviceName} server port ${addressInfo.port}`);
        await server.close;
      }
      await StageLinq.discovery.unannounce();
    } catch (e) {
      throw new Error(e);
    }
  }
}