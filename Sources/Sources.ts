import { EventEmitter } from 'events';
import { Source } from '../types';
import { DeviceId } from '../devices'
import { StageLinq } from '../StageLinq';
import { Logger } from '../LogEmitter';
import * as fs from 'fs';
import { DbConnection } from './DbConnection';
import { getTempFilePath } from '../utils';


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
  private _sources: Map<string, Source> = new Map();
  public readonly parent: StageLinq;

  /**
   * @constructor
   * @param {StageLinq} parent 
   */
  constructor(parent: StageLinq) {
    super();
    this.parent = parent;
  }

  /** 
   * Check if sources has Source
   * @param {string} sourceName - Name of source in EngineOS, eg: 'DJ STICK (USB 1)'
   * @param {DeviceId} deviceId - DeviceID instance
   * @returns {boolean} true if has source 
   */
  hasSource(sourceName: string, deviceId: DeviceId): boolean {
    return this._sources.has(`${deviceId.string}${sourceName}`);
  }

  /** 
   * Check if sources has Source AND source has downloaded DB
   * @param {string} sourceName - Name of source in EngineOS, eg: 'DJ STICK (USB 1)'
   * @param {DeviceId} deviceId - DeviceID instance
   * @returns {boolean} true if has Source AND the source has downloaded DB
   */
  hasSourceAndDB(sourceName: string, deviceId: DeviceId): boolean {
    const source = this._sources.get(`${deviceId.string}${sourceName}`);
    return (source && source.database?.local) ? true : false
  }

  /**
   * Get Source
   * @param {string} sourceName Name of source in EngineOS, eg: 'DJ STICK (USB 1)'
   * @param {DeviceId} deviceId DeviceID instance
   * @returns {Source}
   */
  getSource(sourceName: string, deviceId: DeviceId): Source {
    return this._sources.get(`${deviceId.string}${sourceName}`);
  }

  /**
   * Get all Sources
   * @param {DeviceId} [deviceId] Optional narrow results by DeviceId
   * @returns {Source[]} an array of Sources
   */
  getSources(deviceId?: DeviceId): Source[] {
    if (deviceId) {
      const filteredMap = new Map([...this._sources.entries()].filter(entry => entry[0].substring(0, 36) == deviceId.string))
      return [...filteredMap.values()]
    }
    return [...this._sources.values()]
  }

  /**
   * Add a new Source
   * @param {Source} source 
   */
  setSource(source: Source) {
    this._sources.set(`${source.deviceId.string}${source.name}`, source);
    this.emit('newSource', source);
  }

  /**
   * Delete Source 
   * @param {string} sourceName name of the source
   * @param {DeviceId} deviceId 
   */
  deleteSource(sourceName: string, deviceId: DeviceId) {
    this._sources.delete(`${deviceId.string}${sourceName}`)
    this.emit('sourceRemoved', sourceName, deviceId);
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
  async downloadDb(source: Source) {

    Logger.debug(`downloadDb request for ${source.name}`);
    const dbPath = getTempFilePath(`${source.deviceId.string}/${source.name}/m.db`);
    Logger.debug(`Reading database ${source.deviceId.string}/${source.name}`);

    const file = await source.service.getFile(source, source.database.remote.location);
    Logger.debug(`Saving ${source.deviceId.string}/${source.name} to ${dbPath}`);
    fs.writeFileSync(dbPath, Buffer.from(file));

    source.database.local = {
      path: dbPath,
      connection: new DbConnection(dbPath)
    };
    this.setSource(source);
    Logger.debug(`Downloaded ${source.deviceId.string}/${source.name} to ${dbPath}`);
    this.emit('dbDownloaded', source);
  }
}

