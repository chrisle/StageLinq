import { EventEmitter } from 'events';
//import * as Services from '../services';
import { Source, DeviceId} from '../types';
import { StageLinq } from '../StageLinq';

export declare interface Sources {
	//on(event: 'newSource', listener: (device: Device) => void): this;
	//on(event: 'newService', listener: (device: Device, service: InstanceType<typeof Services.Service>) => void): this;
}

export class Sources extends EventEmitter {
    private _sources: Map<string, Source> = new Map();
    public readonly parent: InstanceType<typeof StageLinq>;

    constructor(parent: InstanceType<typeof StageLinq>) {
        super();
        this.parent = parent;
    }

  hasSource(sourceName: string, deviceId: DeviceId): boolean {
    return this._sources.has(`${sourceName}${deviceId.string}`);
  }

  getSource(sourceName: string, deviceId: DeviceId): Source {
    return this._sources.get(`${sourceName}${deviceId.string}`);
  }
  
  setSource(source: Source) {
    this._sources.set(`${source.name}${source.deviceId.string}`, source);
  }
  
  getSourceList(): string[] {
    return [...this._sources.keys()]
  } 

  getSources(): Source[] {
    return [...this._sources.values()]
  }

//   getSourcesArray()  {
//     return this._sources.entries()
//   }
}  

