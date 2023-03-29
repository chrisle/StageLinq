import { EventEmitter } from 'events';
import { Source } from '../types';
import { DeviceId } from '../devices'
import { StageLinq } from '../StageLinq';
import { Logger } from '../LogEmitter';

export declare interface Sources {
  on(event: 'newSource', listener: (source: Source) => void): this;
}


export class Sources extends EventEmitter {
  private _sources: Map<string, Source> = new Map();
  public readonly parent: InstanceType<typeof StageLinq>;

  constructor(parent: InstanceType<typeof StageLinq>) {
    super();
    this.parent = parent;
  }

  /** 
   * 
   * @param {string} sourceName - Name of source in EngineOS, eg: 'DJ STICK (USB 1)'
   * @param {DeviceId} deviceId - DeviceID instance
   * @returns boolean
   */
  hasSource(sourceName: string, deviceId: DeviceId): boolean {
    return this._sources.has(`${sourceName}${deviceId.string}`);
  }

  /**
   * 
   * @param sourceName Name of source in EngineOS, eg: 'DJ STICK (USB 1)'
   * @param deviceId DeviceID instance
   * @returns Source
   */
  getSource(sourceName: string, deviceId: DeviceId): Source {
    return this._sources.get(`${deviceId.string}${sourceName}`);
  }

  /**
   * Add a new Source
   * @param source 
   */
  setSource(source: Source) {
    this._sources.set(`${source.deviceId.string}${source.name}`, source);
  }

  getSources(deviceId?: DeviceId): Source[] {
    if (deviceId) {
      const filteredMap = new Map([...this._sources.entries()].filter(entry => entry[0].substring(0,36) == deviceId.string))
      return [...filteredMap.values()]
    }
    return [...this._sources.values()]
  }

  deleteSource(sourceName: string, deviceId: DeviceId) {
    this._sources.delete(`${deviceId.string}${sourceName}`)
  }

  async downloadFile(source: Source, path: string): Promise<Uint8Array> {
    const service = source.service;
    await service.isAvailable();

    try {
      const file = await service.getFile(path, service.socket);
      return file;
    } catch (err) {
      Logger.error(err);
      throw new Error(err);
    }
  }
}

