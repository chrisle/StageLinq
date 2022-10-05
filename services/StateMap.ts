import { strict as assert } from 'assert';
import { StageLinqValue } from '../types';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service } from './Service';
import type { ServiceMessage } from '../types';
import { deviceIdFromBuff } from '../types';
import { Socket, AddressInfo } from 'net';
import { Console } from 'console';
// import { Logger } from '../LogEmitter';

export const States = [
  // Mixer
  StageLinqValue.MixerCH1faderPosition,
  StageLinqValue.MixerCH2faderPosition,
  StageLinqValue.MixerCrossfaderPosition,
/*
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
*/
  StageLinqValue.ClientPreferencesLayerA,
  StageLinqValue.ClientPreferencesPlayer,
  StageLinqValue.ClientPreferencesPlayerJogColorA,
  StageLinqValue.ClientPreferencesPlayerJogColorB,
  StageLinqValue.EngineDeck1DeckIsMaster,
  StageLinqValue.EngineDeck2DeckIsMaster,
  
  StageLinqValue.EngineMasterMasterTempo,
  
  StageLinqValue.EngineSyncNetworkMasterStatus,
  StageLinqValue.MixerChannelAssignment1,
  StageLinqValue.MixerChannelAssignment2,
  StageLinqValue.MixerChannelAssignment3,
  StageLinqValue.MixerChannelAssignment4,
  
  
  StageLinqValue.MixerNumberOfChannels,

];

const MAGIC_MARKER = 'smaa';
// FIXME: Is this thing really an interval?
const MAGIC_MARKER_INTERVAL = 0x000007d2;
const MAGIC_MARKER_JSON = 0x00000000;

export interface StateData {
  name: string;
  json?: {
    type: number;
    string?: string;
    value?: number;
  };
  interval?: number;
}

export class StateMap extends Service<StateData> {
  async init() {
   // for (const state of States) {
   //   await this.subscribeState(state, 0);
   // }
  }

  public async subscribe(socket: Socket) {
    for (const state of States) {
      await this.subscribeState(state, 0, socket);
    }
  }

  protected parseData(p_ctx: ReadContext, socket: Socket): ServiceMessage<StateData> {
    const length = p_ctx.readUInt32();
    
    //console.warn(length);
    //assert(marker === MAGIC_MARKER);
    if (length === 0) {
      const token = p_ctx.read(16);
      const svcName = p_ctx.readNetworkStringUTF16();
      const svcPort = p_ctx.readUInt16();
      console.log(deviceIdFromBuff(token), svcName, svcPort)
      this.subscribe(socket);
    } else {
      const msg = p_ctx.readRemainingAsNewBuffer();
      //console.warn(msg);
      p_ctx.rewind();
      p_ctx.seek(4);
      const marker = p_ctx.getString(4);
      const type = p_ctx.readUInt32();
      //console.warn(marker, type);
      switch (type) {
        case MAGIC_MARKER_JSON: {
          const name = p_ctx.readNetworkStringUTF16();
          const json = JSON.parse(p_ctx.readNetworkStringUTF16());
          //console.warn(name,json);
          return {
            id: MAGIC_MARKER_JSON,
            message: {
              name: name,
              json: json,
            },
          };
        }

        case MAGIC_MARKER_INTERVAL: {
          const name = p_ctx.readNetworkStringUTF16();
          const interval = p_ctx.readInt32();
          return {
            id: MAGIC_MARKER_INTERVAL,
            message: {
              name: name,
              interval: interval,
            },
          };
        }

        default: {
          console.warn('not json :(');
        }
          break;
      }
      assert.fail(`Unhandled type ${type}`);
    }

    
    return null;
  }

  protected messageHandler(p_data: ServiceMessage<StateData>): void {
     console.warn(p_data);
       //`${p_data.message.name} => ${
       //  p_data.message.json ? JSON.stringify(p_data.message.json) : p_data.message.interval
       //}`
     //);
  }

  private async subscribeState(p_state: string, p_interval: number, socket: Socket) {
    // Logger.log(`Subscribe to state '${p_state}'`);
    const getMessage = function (): Buffer {
      const ctx = new WriteContext();
      ctx.writeFixedSizedString(MAGIC_MARKER);
      ctx.writeUInt32(MAGIC_MARKER_INTERVAL);
      ctx.writeNetworkStringUTF16(p_state);
      ctx.writeUInt32(p_interval);
      return ctx.getBuffer();
    };

    const message = getMessage();
    {
      const ctx = new WriteContext();
      ctx.writeUInt32(message.length);
      ctx.write(message)
      const written = await socket.write(ctx.getBuffer());
      //assert(written === 4);
    }
    {
      //const written = await socket.write(message);
      //assert(written === message.length);
    }
  }
}
