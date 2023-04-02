import { EventEmitter } from 'events';
import { Source } from '../types';
import { DeviceId } from '../devices'
import { StageLinq } from '../StageLinq';
import { Logger } from '../LogEmitter';


export declare interface Sources {
  /**
   * 
   * @event newSource
   */
  on(event: 'newSource', listener: (source: Source) => void): this;
}


export class Sources extends EventEmitter {
  private _sources: Map<string, Source> = new Map();
  public readonly parent: InstanceType<typeof StageLinq>;

  /**
   * @constructor
   * @param {StageLinq} parent 
   */
  constructor(parent: InstanceType<typeof StageLinq>) {
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
  }

  /**
   * Delete Source 
   * @param {string} sourceName name of the source
   * @param {DeviceId} deviceId 
   */
  deleteSource(sourceName: string, deviceId: DeviceId) {
    this._sources.delete(`${deviceId.string}${sourceName}`)
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
}

