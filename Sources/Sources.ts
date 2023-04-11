import { EventEmitter } from 'events';
import { ServiceList } from '../types';
import { DeviceId } from '../devices'
import { Logger } from '../LogEmitter';
import * as fs from 'fs';
import { DbConnection } from './DbConnection';
import { getTempFilePath } from '../utils';
import { StageLinq } from '../StageLinq';
import { Broadcast, BroadcastMessage, Transfer, FileTransfer } from '../services';

export interface Source {
  name: string;
  deviceId: DeviceId;
  service: FileTransfer;
  dbFiles?: string[];
  databases?: Database[];
}

export declare interface Sources {
  /**
   * 
   * @event newSource
   */
  on(event: 'newSource', listener: (source: Source) => void): this;
  on(event: 'sourceRemoved', listener: (sourceName: string, deviceId: DeviceId) => void): this;
  on(event: 'dbDownloaded', listener: (source: Source) => void): this;
}

export class Sources extends EventEmitter {
  #sources: Map<string, Source> = new Map();

  /** 
   * Check if sources has Source
   * @param {string} sourceName - Name of source in EngineOS, eg: 'DJ STICK (USB 1)'
   * @param {DeviceId} deviceId - DeviceID instance
   * @returns {boolean} true if has source 
   */
  hasSource(sourceName: string, deviceId: DeviceId): boolean {
    return this.#sources.has(`${deviceId.string}${sourceName}`);
  }

  /** 
   * Check if sources has Source AND source has downloaded DB
   * @param {string} sourceName - Name of source in EngineOS, eg: 'DJ STICK (USB 1)'
   * @param {DeviceId} deviceId - DeviceID instance
   * @returns {boolean} true if has Source AND the source has downloaded DB
   */
  hasSourceAndDB(sourceName: string, deviceId: DeviceId): boolean {
    const source = this.#sources.get(`${deviceId.string}${sourceName}`);
    const dbs = source.databases.filter(db => db.downloaded)
    return (source && dbs.length) ? true : false
  }

  /**
   * Get Source
   * @param {string} sourceName Name of source in EngineOS, eg: 'DJ STICK (USB 1)'
   * @param {DeviceId} deviceId DeviceID instance
   * @returns {Source}
   */
  getSource(sourceName: string, deviceId: DeviceId): Source {
    return this.#sources.get(`${deviceId.string}${sourceName}`);
  }

  /**
   * Get all Sources
   * @param {DeviceId} [deviceId] Optional narrow results by DeviceId
   * @returns {Source[]} an array of Sources
   */
  getSources(deviceId?: DeviceId): Source[] {
    if (deviceId) {
      const filteredMap = new Map([...this.#sources.entries()].filter(entry => entry[0].substring(0, 36) == deviceId.string))
      return [...filteredMap.values()]
    }
    return [...this.#sources.values()]
  }

  /**
   * Add a new Source
   * @param {Source} source 
   */
  setSource(source: Source) {
    this.#sources.set(`${source.deviceId.string}${source.name}`, source);
    this.emit('newSource', source);
  }

  /**
   * Delete Source 
   * @param {string} sourceName name of the source
   * @param {DeviceId} deviceId 
   */
  deleteSource(sourceName: string, deviceId: DeviceId) {
    this.#sources.delete(`${deviceId.string}${sourceName}`)
    this.emit('sourceRemoved', sourceName, deviceId);
  }

  /**
   * Get Databases by UUID
   * @param {string} uuid 
   * @returns {Database[]}
   */
  getDBByUuid(uuid: string): Database[] {
    const dbs = [...this.#sources.values()].map(src => src.databases).flat(1)
    return dbs.filter(db => db.uuid == uuid)
  }

  /**
   * Download a file from Source
   * @param {Source} source 
   * @param {string} path 
   * @returns {Promise<Uint8Array>}
   */
  async downloadFile(source: Source, path: string): Promise<Uint8Array> {
    const service = source.service;
    await service.isAvailable();

    try {
      const file = await service.getFile(source, path);
      return file;
    } catch (err) {
      Logger.error(err);
      throw new Error(err);
    }
  }

  /**
   * Download DBs from source
   * @param {Source} source 
   */
  async downloadDbs(source: Source) {
    Logger.debug(`downloadDb request for ${source.name}`);
    for (const database of source.databases) {
      Logger.info(`downloading ${database.filename}`)
      await database.downloadDb();
    }
    this.emit('dbDownloaded', source);
    this.setSource(source);
    Logger.debug(`Downloaded ${source.deviceId.string}/${source.name}`);
  }
}

type DBInfo = {
  id: number;
  uuid: string;
}

export class Database {
  size: number;
  filename: string;
  remotePath: string;
  localPath: string = null;
  uuid: string = null;
  source: Source = null;
  txid: number;
  transfer: Transfer = null;
  downloaded: boolean = false;
  static #instances: Map<string, Database> = new Map();

  /**
   * @constructor
   * @param {string} filename name of the file EG: 'm.db'
   * @param {number} size size of the file
   * @param {string} remotePath remote path (excl filename) of file
   * @param {Source} source Source that the DB file is on
   * @param {Transfer} transfer 
   */
  constructor(filename: string, size: number, remotePath: string, source: Source, transfer: Transfer) {
    this.filename = filename;
    this.size = size;
    this.remotePath = remotePath;
    this.transfer = transfer
    this.source = source;
    this.localPath = getTempFilePath(`${source.deviceId.string}/${source.name}/`);
  }

  get remoteDBPath() {
    return `${this.remotePath}/${this.filename}`
  }

  get localDBPath() {
    return `${this.localPath}/${this.filename}`
  }

  get connection() {
    return new DbConnection(this.localDBPath)
  }

  private addInstance(db: Database) {
    Database.#instances.set(db.uuid, db)
  }

  /**
   * 
   * @param source 
   */
  async downloadDb() {
    const source = this.source;
    Logger.info(`Reading database ${source.deviceId.string}/${source.name}/${this.filename}`);
    const file = await source.service.getFile(source, this.remoteDBPath, this.transfer);
    Logger.info(`Saving ${this.remoteDBPath}} to ${this.localDBPath}`);
    fs.writeFileSync(this.localDBPath, Buffer.from(file));
    this.downloaded = true;
    await this.processDB();
    Logger.info(`Downloaded ${source.deviceId.string}/${source.name} to ${this.remoteDBPath}`);
  }

  private async processDB() {
    const db = new DbConnection(this.localDBPath)
    const result: DBInfo[] = await db.querySource('SELECT * FROM Information LIMIT 1')
    this.uuid = result[0].uuid
    db.close();
    this.addInstance(this);

    if (StageLinq.options.services.includes(ServiceList.Broadcast)) {
      Broadcast.emitter.addListener(this.uuid, (key, value) => this.broadcastListener(key, value))
      Logger.debug(`Sources added broadcast listener for ${this.uuid}`);
    }
  }

  private broadcastListener(key: string, value: BroadcastMessage) {
    Logger.silly(`MSG FROM BROADCAST ${key}`, value);
    this.source.service.getSourceDirInfo(this.source);
  }

}
