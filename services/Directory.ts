import { strict as assert } from 'assert';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service } from './Service';
import type { ServiceMessage } from '../types';
import { Logger } from '../LogEmitter';



export interface DirectoryData {
  
}

export class Directory extends Service<DirectoryData> {
  async init() {
    
  }

  protected parseData(p_ctx: ReadContext): ServiceMessage<DirectoryData> {
   
    return
  }

  protected messageHandler(_: ServiceMessage<DirectoryData>): void {
   
  }
}
