import { strict as assert } from 'assert';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service, ServiceHandler } from './Service';
import { ServiceMessage, DeviceId, MessageId } from '../types';
import { Socket } from 'net';
import { Logger } from '../LogEmitter';
import { sleep } from '../utils';
import * as Services from '../services';

import * as stagelinqConfig from '../stagelinqConfig.json';

export type Player = typeof stagelinqConfig.player;
export type PlayerDeck = typeof stagelinqConfig.playerDeck;
export type Mixer = typeof stagelinqConfig.mixer;

const MAGIC_MARKER = 'smaa';
// TODO: Is this thing really an interval?
const MAGIC_MARKER_INTERVAL = 0x000007d2;
const MAGIC_MARKER_JSON = 0x00000000;

function stateReducer(obj: any, prefix: string): string[] {
  const entries = Object.entries(obj)
  const retArr = entries.map(([key, value]) => {
    return (typeof value === 'object' ? [...stateReducer(value, `${prefix}${key}/`)] : `${prefix}${key}`)
  })
  return retArr.flat()
}

const playerStateValues = stateReducer(stagelinqConfig.player, '/');
const mixerStateValues = stateReducer(stagelinqConfig.mixer, '/');
const controllerStateValues = [...playerStateValues,  ...mixerStateValues];


export interface StateData {
  service: InstanceType<typeof Services.StateMap> 
  name?: string;
  json?: {
    type: number;
    string?: string;
    value?: number;
    state?: boolean;
  };
  interval?: number;
}

export class StateMapHandler extends ServiceHandler<StateData> {
  public name: string = 'StateMap'

  public setupService(service: Service<StateData>, deviceId: DeviceId) {
    Logger.debug(`Setting up ${service.name} for ${deviceId.toString()}`);
    const stateMap = service as Services.StateMap;
    this.addDevice(deviceId, service);

    const listener = (data: ServiceMessage<Services.StateData>) => {
      if (data && data.message && data.message.json) {
       // console.log(data.message.name,">>", data.message.json);
        this.emit('stateMessage', data);
      }
    };

    stateMap.addListener('stateMessage', listener)

    stateMap.on('newStateMapDevice',  (deviceId: DeviceId, service: InstanceType<typeof Services.StateMap>) => {
      Logger.debug(`New StateMap Device ${deviceId.toString()}`)
      this.emit('newStateMapDevice',  deviceId, service);
      //stateMap.subscribe();
      assert(service);
    })
  }
}

export class StateMap extends Service<StateData> {
  name: string = "StateMap";

  async init() {
  }

  public async subscribe() {
    
    const socket = this.socket;
    while (!this.parent.discovery.hasConnectionInfo(this.deviceId)) {
      await sleep(200);
    }

    Logger.silly(`Sending Statemap subscriptions to ${socket.remoteAddress}:${socket.remotePort} ${this.deviceId.toString()}`);

    const thisPeer = this.parent.discovery.getConnectionInfo(this.deviceId);

    switch (thisPeer?.device?.type) {
      case "PLAYER": {
        for (let state of playerStateValues) {
          await this.subscribeState(state, 0, socket);
        }
        let playerDeckStateValues: string[] = [];
        for (let i=0; i< thisPeer.device.decks; i++) {
          playerDeckStateValues = [...playerDeckStateValues, ...stateReducer(stagelinqConfig.playerDeck, `/Engine/Deck${i+1}/`)];
        } 
        
        for (let state of playerDeckStateValues) {
          await this.subscribeState(state, 0, socket);
        }
        
        break;
      }
      case "CONTROLLER": {
        for (let state of controllerStateValues) {
          await this.subscribeState(state, 0, socket);
        }
        let playerDeckStateValues: string[] = [];
        for (let i=0; i< thisPeer.device.decks; i++) {
          playerDeckStateValues = [...playerDeckStateValues, ...stateReducer(stagelinqConfig.playerDeck, `/Engine/Deck${i+1}/`)];
        } 
        
        for (let state of playerDeckStateValues) {
          await this.subscribeState(state, 0, socket);
        }

        break;
      }
      case "MIXER": {
        for (let state of mixerStateValues) {
          await this.subscribeState(state, 0, socket);
        }
        break;
      }
      default: 
      break;
    }
  }

  protected parseServiceData(messageId:number, deviceId: DeviceId, serviceName: string, socket: Socket): ServiceMessage<StateData> {
    Logger.silly(`${MessageId[messageId]} to ${serviceName} from ${deviceId.toString()}`)
    sleep(500)
    assert(socket);
    
    this.emit('newStateMapDevice', deviceId, this)
    return
  }

  protected parseData(p_ctx: ReadContext, socket: Socket): ServiceMessage<StateData> {
    assert(this.deviceId);
    const marker = p_ctx.getString(4);
    if (marker !== MAGIC_MARKER) {
      Logger.error(assert(marker !== MAGIC_MARKER));
    }
    assert(marker === MAGIC_MARKER);
    const type = p_ctx.readUInt32();
    switch (type) {
      case MAGIC_MARKER_JSON: {
        const name = p_ctx.readNetworkStringUTF16();
        let jsonString = "";
        try {
          jsonString = p_ctx.readNetworkStringUTF16();
          const json = JSON.parse(jsonString);
          return {
            id: MAGIC_MARKER_JSON,
            deviceId: this.deviceId,
            socket: socket,
            message: {
              name: name,
              
              service: this,
              json: json,
              
            },
          };
        } catch(err) {
          Logger.error(this.name, jsonString, err);
        }
      }

      case MAGIC_MARKER_INTERVAL: {
        const name = p_ctx.readNetworkStringUTF16();
        const interval = p_ctx.readInt32();
        return {
          id: MAGIC_MARKER_INTERVAL,
          socket: socket,
          deviceId: this.deviceId,
          message: {
            name: name,
            service: this,
            interval: interval,
          },
        };
      }

      default: 
      break;
    }
    assert.fail(`Unhandled type ${type}`);
    return null;
  }

  protected messageHandler(p_data: ServiceMessage<StateData>): void {
    //TODO do we need to emit intervals?
    if (p_data?.message?.interval) {
      //console.warn(p_data.deviceId.toString(), p_data.socket.localPort, p_data.message.interval, p_data.message.name)
      //this.emit('stateMessage', p_data);
    } else {
      this.emit('stateMessage', p_data);
    }

    if (p_data && p_data.message.json) { 
      Logger.silly(
       `${p_data.deviceId.toString()} ${p_data.message.name} => ${
         p_data.message.json ? JSON.stringify(p_data.message.json) : p_data.message.interval
       }`
     );
    }
  }

  private async subscribeState(p_state: string, p_interval: number, socket: Socket) {
    
    const getMessage = function (): Buffer {
      const ctx = new WriteContext();
      ctx.writeFixedSizedString(MAGIC_MARKER);
      ctx.writeUInt32(MAGIC_MARKER_INTERVAL);
      ctx.writeNetworkStringUTF16(p_state);
      ctx.writeUInt32(p_interval);
      return ctx.getBuffer();
    };

    const message = getMessage();
    
    const ctx = new WriteContext();
    ctx.writeUInt32(message.length);
    ctx.write(message)
    const buffer = ctx.getBuffer();
    await socket.write(buffer);
  }
}