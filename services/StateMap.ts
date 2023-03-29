import { strict as assert } from 'assert';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service, ServiceHandler } from './Service';
import { ServiceMessage, MessageId, StageLinqValueObj } from '../types';
import { DeviceId } from '../devices'
import { Socket } from 'net';
import { Logger } from '../LogEmitter';
import { sleep } from '../utils';
import * as Services from '../services';
import { StageLinq } from '../StageLinq';
import * as stagelinqConfig from '../stagelinqConfig.json';

export type Player = typeof stagelinqConfig.player;
export type PlayerDeck = typeof stagelinqConfig.playerDeck;
export type Mixer = typeof stagelinqConfig.mixer;

const MAGIC_MARKER = 'smaa';
// TODO: Is this thing really an interval?

enum Action {
  request = 0x000007d2,
  response = 0x00000000,
}

enum Result {
  accept = 0x00000000,
  reject = 0xffffffff,
  inquire = 0x00000064
}

const MAGIC_MARKER_INTERVAL = 0x000007d2;
const MAGIC_MARKER_JSON = 0x00000000;

function stateReducer(obj: any, prefix: string): string[] {
  const entries = Object.entries(obj)
  const retArr = entries.map(([key, value]) => {
    return (typeof value === 'object' ? [...stateReducer(value, `${prefix}${key}/`)] : `${prefix}${key}`)
  })
  return retArr.flat()
}

// const playerStateValues = stateReducer(stagelinqConfig.player, '/');
// const mixerStateValues = stateReducer(stagelinqConfig.mixer, '/');
// const controllerStateValues = [...playerStateValues, ...mixerStateValues];

const playerStateValues = Object.values(StageLinqValueObj.player);
const mixerStateValues = Object.values(StageLinqValueObj.mixer);
const controllerStateValues = [...playerStateValues, ...mixerStateValues];


export type StateMapDevice = InstanceType<typeof Services.StateMap>

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
  public readonly name = 'StateMap';
  public deviceTrackRegister: Map<string, string> = new Map();

  public setupService(service: Service<StateData>, deviceId: DeviceId) {
    Logger.debug(`Setting up ${service.name} for ${deviceId.string}`);
    const stateMap = service as Services.StateMap;
    this.addDevice(deviceId, service);

    const listener = (data: ServiceMessage<Services.StateData>) => {
      if (data && data.message && data.message.json) {
        this.emit('stateMessage', data);
      }
    };

    stateMap.addListener('stateMessage', listener)

    stateMap.on('newDevice', (service: InstanceType<typeof Services.StateMap>) => {
      Logger.debug(`New StateMap Device ${service.deviceId.string}`)
      this.emit('newDevice', service);
      assert(service);
    })
  }
}

// interface reducer<T> {
//   buffer: Buffer,
//   obj: T;
// }

// class cStateData implements StateData {
//   service: 
// }

// function readReducer(buffer: Buffer, obj: <T>, struct: )

export class StateMap extends Service<StateData> {
  public readonly name = "StateMap";
  public readonly handler: StateMapHandler;
  //#stateValues: Map<string, string> = new Map();
  #hasReceivedState: boolean = false;

  constructor(p_parent: InstanceType<typeof StageLinq>, serviceHandler: StateMapHandler, deviceId?: DeviceId) {
    super(p_parent, serviceHandler, deviceId)
    this.handler = this._handler as StateMapHandler
  }

  public async subscribe() {
    const socket = this.socket;
    while (!this.parent.discovery.hasConnectionInfo(this.deviceId)) {
      await sleep(200);
    }

    Logger.silly(`Sending Statemap subscriptions to ${socket.remoteAddress}:${socket.remotePort} ${this.deviceId.string}`);
    const thisPeer = this.parent.discovery.getConnectionInfo(this.deviceId);

    
    // const states = [
    //   '/Engine/Deck1/CurrentBPM',
    //   '/Engine/Deck2/CurrentBPM',
    //   '/Engine/Deck3/CurrentBPM',
    //   '/Engine/Deck4/CurrentBPM',
    //   '/Mixer/NumberOfChannels',
    //   '/Mixer/ChannelAssignment1',
    //   '/Mixer/ChannelAssignment2',
    //   '/Mixer/ChannelAssignment3',
    //   '/Mixer/ChannelAssignment4',
    //   '/Mixer/CH1faderPosition'
    // ]

    // for (const [key, value] of Object.entries(StageLinqValueObj)) {
    //   this.#stateValues.set(value, key);
    //   console.log(`${key}: ${value}`);
    // }

   

   // this.#subscribeStates(Object.values(StageLinqValueObj),100, socket)

    // for (let value of Object.values(StageLinqValueObj)) {
    //   console.log(value)
    //   await this.subscribeState(value, 0, socket);
    //   await sleep(250)
    // }

    let stateValueArray: string[] = [];

    switch (thisPeer?.device?.type) {
      case "PLAYER": {
        for (let state of playerStateValues) {
          //await this.subscribeState(state, 0, socket);
          
          stateValueArray.push(state);
        }
        let playerDeckStateValues: string[] = [];
        for (let i = 0; i < thisPeer.device.decks; i++) {
          playerDeckStateValues = [...playerDeckStateValues, ...stateReducer(stagelinqConfig.playerDeck, `/Engine/Deck${i + 1}/`)];
        }
        for (let state of playerDeckStateValues) {
          const stateValue = `${this.deviceId.string},/${state.split('/').slice(1, 3).join("/")}`
          const newValue = `{${this.deviceId}},${state.split('/').slice(2, 3).shift().substring(4, 5)}`
          this.handler.deviceTrackRegister.set(stateValue, newValue);
          //await this.subscribeState(state, 0, socket);
          stateValueArray.push(state);
        }
        break;
      }

      case "CONTROLLER": {
        for (let state of controllerStateValues) {
          //await this.subscribeState(state, 0, socket);
          //this.#stateValues.set
          stateValueArray.push(state);
        }
        let playerDeckStateValues: string[] = [];
        for (let i = 0; i < thisPeer.device.decks; i++) {
          playerDeckStateValues = [...playerDeckStateValues, ...stateReducer(stagelinqConfig.playerDeck, `/Engine/Deck${i + 1}/`)];
        }
        for (let state of playerDeckStateValues) {
          //await this.subscribeState(state, 0, socket);
          stateValueArray.push(state);
        }
        break;
      }
      case "MIXER": {
        await sleep(1000);
        for (let state of mixerStateValues) {
          await this.subscribeState(state, 0, socket);
          //stateValueArray.push(state);
        }
        break;
      }
      default:
        break;
    }
    if (stateValueArray.length) {
      this.#subscribeStates(stateValueArray,0, socket)
    }
  }

  protected parseServiceData(messageId: number, deviceId: DeviceId, serviceName: string, socket: Socket): ServiceMessage<StateData> {
    Logger.silly(`${MessageId[messageId]} to ${serviceName} from ${deviceId.string}`)
    sleep(500)
    assert(socket);
    this.emit('newDevice', this)
    return
  }

  protected parseData(p_ctx: ReadContext, socket: Socket): ServiceMessage<StateData> {
    assert(this.deviceId);
    //const buffer = p_ctx.readRemainingAsNewBuffer(); //new DataView(p_ctx.readRemainingAsNewArrayBuffer());
    
    //buffer.byteLength
    
   //const marker = p_ctx.getString(4);
   //const action = p_ctx.read(4)
    // const message = p_ctx.read()
    // const response = p_ctx.read(4);
    // p_ctx.rewind();
    // p_ctx.seek(12);
    
    // console.warn(`${action} ${response} ${message}`)

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
        } catch (err) {
          Logger.error(this.name, jsonString, err);
        }
      }

      case MAGIC_MARKER_INTERVAL: {
        const name = p_ctx.readNetworkStringUTF16();
        const interval = p_ctx.readInt32();
        p_ctx.seek(-4);

        //console.warn(`${this.deviceId.string} name: ${name} interval: ${interval} last4bytes ${Buffer.from(p_ctx.read(4)).toString('hex')} sizeLeft: ${p_ctx.sizeLeft()}`)
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
  }

  // private mixerAssignmentAdapter(data: ServiceMessage<StateData>) {
  //   const keyString = `${this.deviceId.string},/Mixer/CH${data.message.name.substring(data.message.name.length - 1, data.message.name.length)}faderPosition`
  //   const valueString = `${data.message.json.string},/Mixer/ChannelFaderPosition`;
  //   this.handler.deviceTrackRegister.set(keyString, valueString);
  // }

  protected messageHandler(p_data: ServiceMessage<StateData>): void {
    //TODO do we need to emit intervals?
    // if (p_data?.message?.name.substring(0, p_data?.message?.name?.length - 1) == "/Mixer/ChannelAssignment") {
    //   this.mixerAssignmentAdapter(p_data);
    // }

    if (p_data?.message?.interval) {
        this.sendStateResponse(p_data.message.name, p_data.socket);
    } 
    if (p_data?.message) {
      //this.#stateValues.set(p_data.message.name, "")
      this.emit('stateMessage', p_data);
    }

    if (p_data && p_data.message.json && !this.#hasReceivedState) {
      Logger.silent(
        `${p_data.deviceId.string} ${p_data.message.name} => ${p_data.message.json ? JSON.stringify(p_data.message.json) : p_data.message.interval
        }`);
        //console.warn(`Received State ${this.deviceId}`);
        this.#hasReceivedState = true;
    }
  }


  private async sendStateResponse(p_state: string, socket: Socket) {

    const getMessage = function (): Buffer {
      const ctx = new WriteContext();
      ctx.writeFixedSizedString(MAGIC_MARKER);
      ctx.writeUInt32(Action.response);
      ctx.writeNetworkStringUTF16(p_state);
      ctx.writeUInt32(Result.reject);
      return ctx.getBuffer();
    };

    const message = getMessage();

    const ctx = new WriteContext();
    ctx.writeUInt32(message.length);
    ctx.write(message)
    const buffer = ctx.getBuffer();
    await socket.write(buffer);
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

  async #subscribeStates(p_states: string[], p_interval: number, socket: Socket) {

    const getMessage = function (states: string[]): Buffer {
      const ctx = new WriteContext();
      for (let state of states) {
        ctx.writeFixedSizedString(MAGIC_MARKER);
        ctx.writeUInt32(MAGIC_MARKER_INTERVAL);
        ctx.writeNetworkStringUTF16(state);
        ctx.writeUInt32(p_interval);
      }
     
      return ctx.getBuffer();
    };

    

    
    const message = getMessage(p_states);

    const ctx = new WriteContext();
    ctx.writeUInt32(message.length);
    ctx.write(message)
    const buffer = ctx.getBuffer();
    await socket.write(buffer);
  }
}