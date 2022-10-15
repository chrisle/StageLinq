import { strict as assert } from 'assert';
import { 
  MessageId, 
  StageLinqValue, 
  //StageLinqValueObj, 
} from '../types';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service } from './Service';
import type { ServiceMessage, DeviceId } from '../types';
import { Socket } from 'net';
import { Logger } from '../LogEmitter';
import { sleep } from '../utils';


export const StatesMixer = [ 
  StageLinqValue.MixerCH1faderPosition,
  StageLinqValue.MixerCH2faderPosition,
  StageLinqValue.MixerCH3faderPosition,
  StageLinqValue.MixerCH4faderPosition,
  StageLinqValue.MixerCrossfaderPosition,
  StageLinqValue.MixerChannelAssignment1,
  StageLinqValue.MixerChannelAssignment2,
  StageLinqValue.MixerChannelAssignment3,
  StageLinqValue.MixerChannelAssignment4,
  StageLinqValue.MixerNumberOfChannels,
]

export const States = [
  // Mixer
  
  StageLinqValue.MixerCH1faderPosition,
  StageLinqValue.MixerCH2faderPosition,
  StageLinqValue.MixerCH3faderPosition,
  StageLinqValue.MixerCH4faderPosition,
  StageLinqValue.MixerCrossfaderPosition,
  StageLinqValue.MixerChannelAssignment1,
  StageLinqValue.MixerChannelAssignment2,
  StageLinqValue.MixerChannelAssignment3,
  StageLinqValue.MixerChannelAssignment4,
  StageLinqValue.MixerNumberOfChannels,
  StageLinqValue.ClientPreferencesLayerA,
  StageLinqValue.ClientPreferencesPlayer,
  StageLinqValue.ClientPreferencesPlayerJogColorA,
  StageLinqValue.ClientPreferencesPlayerJogColorB,
  StageLinqValue.EngineDeck1DeckIsMaster,
  StageLinqValue.EngineDeck2DeckIsMaster,
  
  StageLinqValue.EngineMasterMasterTempo,
  
  StageLinqValue.EngineSyncNetworkMasterStatus,
 
  // Decks
  StageLinqValue.EngineDeck1Play,
  StageLinqValue.EngineDeck1PlayState,
  StageLinqValue.EngineDeck1PlayStatePath,
  StageLinqValue.EngineDeck1TrackArtistName,
  StageLinqValue.EngineDeck1TrackTrackNetworkPath,
  StageLinqValue.EngineDeck1TrackSongLoaded,
  StageLinqValue.EngineDeck1TrackSongName,
  StageLinqValue.EngineDeck1TrackTrackData,
  StageLinqValue.EngineDeck1TrackTrackName,
  StageLinqValue.EngineDeck1CurrentBPM,
  StageLinqValue.EngineDeck1ExternalMixerVolume,

  StageLinqValue.EngineDeck2Play,
  StageLinqValue.EngineDeck2PlayState,
  StageLinqValue.EngineDeck2PlayStatePath,
  StageLinqValue.EngineDeck2TrackArtistName,
  StageLinqValue.EngineDeck2TrackTrackNetworkPath,
  StageLinqValue.EngineDeck2TrackSongLoaded,
  StageLinqValue.EngineDeck2TrackSongName,
  StageLinqValue.EngineDeck2TrackTrackData,
  StageLinqValue.EngineDeck2TrackTrackName,
  StageLinqValue.EngineDeck2CurrentBPM,
  StageLinqValue.EngineDeck2ExternalMixerVolume,

  StageLinqValue.EngineDeck3Play,
  StageLinqValue.EngineDeck3PlayState,
  StageLinqValue.EngineDeck3PlayStatePath,
  StageLinqValue.EngineDeck3TrackArtistName,
  StageLinqValue.EngineDeck3TrackTrackNetworkPath,
  StageLinqValue.EngineDeck3TrackSongLoaded,
  StageLinqValue.EngineDeck3TrackSongName,
  StageLinqValue.EngineDeck3TrackTrackData,
  StageLinqValue.EngineDeck3TrackTrackName,
  StageLinqValue.EngineDeck3CurrentBPM,
  StageLinqValue.EngineDeck3ExternalMixerVolume,

  StageLinqValue.EngineDeck4Play,
  StageLinqValue.EngineDeck4PlayState,
  StageLinqValue.EngineDeck4PlayStatePath,
  StageLinqValue.EngineDeck4TrackArtistName,
  StageLinqValue.EngineDeck4TrackTrackNetworkPath,
  StageLinqValue.EngineDeck4TrackSongLoaded,
  StageLinqValue.EngineDeck4TrackSongName,
  StageLinqValue.EngineDeck4TrackTrackData,
  StageLinqValue.EngineDeck4TrackTrackName,
  StageLinqValue.EngineDeck4CurrentBPM,
  StageLinqValue.EngineDeck4ExternalMixerVolume,
];

const MAGIC_MARKER = 'smaa';
// FIXME: Is this thing really an interval?
const MAGIC_MARKER_INTERVAL = 0x000007d2;
const MAGIC_MARKER_JSON = 0x00000000;

export interface StateData {
  name?: string;
  deviceId?: DeviceId;
  socket?: Socket;
  json?: {
    type: number;
    string?: string;
    value?: number;
  };
  interval?: number;
}

export class StateMap extends Service<StateData> {
  name: string = "StateMap";

  async init() {
  }

  public async subscribe(socket: Socket) {
    
    const deviceId = this.getDeviceIdFromSocket(socket);

    //Logger.debug('checking stateMap', this.parent.discovery.peers.keys());
    while (!this.parent.discovery.peers.has(deviceId.toString())) {
      await sleep(200);
    }

    Logger.debug(`Sending Statemap subscriptions to ${socket.remoteAddress}:${socket.remotePort} ${this.getDeviceIdFromSocket(socket).toString()}`);

    const thisPeer = this.parent.discovery.peers.get(deviceId.toString());

    if (thisPeer.software.name === 'JM08') {
      for (const state of StatesMixer) {
        await this.subscribeState(state, 0, socket);
      }
    } else {
      for (const state of States) {
        await this.subscribeState(state, 0, socket);
      }
      //const keys = Object.keys(StageLinqValueObj);
      //const values = keys.map(key => Reflect.get(StageLinqValueObj,key))
      //for (const value of values) {
      //  await this.subscribeState(value, 0, socket);
      //}    
    }
  }

  
  protected parseServiceData(messageId:number, deviceId: DeviceId, serviceName: string, socket: Socket): ServiceMessage<StateData> {
    Logger.silly(`${MessageId[messageId]} to ${serviceName} from ${deviceId.toString()}`)
    //this.subscribe(socket);
    this.emit('newStateMapDevice', deviceId, socket)
    return
  }

  protected parseData(p_ctx: ReadContext, socket: Socket): ServiceMessage<StateData> {
    const deviceId = this.getDeviceIdFromSocket(socket);
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
            message: {
              name: name,
              deviceId: deviceId,
              json: json,
              socket: socket,
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
          message: {
            name: name,
            deviceId: deviceId,
            interval: interval,
            socket: socket,
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
    if (p_data && p_data.message.json) { 
      Logger.silly(
       `${p_data.message.deviceId.toString()} ${p_data.message.name} => ${
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