"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMap = exports.States = void 0;
const assert_1 = require("assert");
const types_1 = require("../types");
const WriteContext_1 = require("../utils/WriteContext");
const Service_1 = require("./Service");
// import { Logger } from '../LogEmitter';
exports.States = [
    // Mixer
    types_1.StageLinqValue.MixerCH1faderPosition,
    types_1.StageLinqValue.MixerCH2faderPosition,
    types_1.StageLinqValue.MixerCrossfaderPosition,
    // Decks
    types_1.StageLinqValue.EngineDeck1Play,
    types_1.StageLinqValue.EngineDeck1PlayState,
    types_1.StageLinqValue.EngineDeck1PlayStatePath,
    types_1.StageLinqValue.EngineDeck1TrackArtistName,
    types_1.StageLinqValue.EngineDeck1TrackTrackNetworkPath,
    types_1.StageLinqValue.EngineDeck1TrackSongLoaded,
    types_1.StageLinqValue.EngineDeck1TrackSongName,
    types_1.StageLinqValue.EngineDeck1TrackTrackData,
    types_1.StageLinqValue.EngineDeck1TrackTrackName,
    types_1.StageLinqValue.EngineDeck1CurrentBPM,
    types_1.StageLinqValue.EngineDeck1ExternalMixerVolume,
    types_1.StageLinqValue.EngineDeck2Play,
    types_1.StageLinqValue.EngineDeck2PlayState,
    types_1.StageLinqValue.EngineDeck2PlayStatePath,
    types_1.StageLinqValue.EngineDeck2TrackArtistName,
    types_1.StageLinqValue.EngineDeck2TrackTrackNetworkPath,
    types_1.StageLinqValue.EngineDeck2TrackSongLoaded,
    types_1.StageLinqValue.EngineDeck2TrackSongName,
    types_1.StageLinqValue.EngineDeck2TrackTrackData,
    types_1.StageLinqValue.EngineDeck2TrackTrackName,
    types_1.StageLinqValue.EngineDeck2CurrentBPM,
    types_1.StageLinqValue.EngineDeck2ExternalMixerVolume,
    types_1.StageLinqValue.EngineDeck3Play,
    types_1.StageLinqValue.EngineDeck3PlayState,
    types_1.StageLinqValue.EngineDeck3PlayStatePath,
    types_1.StageLinqValue.EngineDeck3TrackArtistName,
    types_1.StageLinqValue.EngineDeck3TrackTrackNetworkPath,
    types_1.StageLinqValue.EngineDeck3TrackSongLoaded,
    types_1.StageLinqValue.EngineDeck3TrackSongName,
    types_1.StageLinqValue.EngineDeck3TrackTrackData,
    types_1.StageLinqValue.EngineDeck3TrackTrackName,
    types_1.StageLinqValue.EngineDeck3CurrentBPM,
    types_1.StageLinqValue.EngineDeck3ExternalMixerVolume,
    types_1.StageLinqValue.EngineDeck4Play,
    types_1.StageLinqValue.EngineDeck4PlayState,
    types_1.StageLinqValue.EngineDeck4PlayStatePath,
    types_1.StageLinqValue.EngineDeck4TrackArtistName,
    types_1.StageLinqValue.EngineDeck4TrackTrackNetworkPath,
    types_1.StageLinqValue.EngineDeck4TrackSongLoaded,
    types_1.StageLinqValue.EngineDeck4TrackSongName,
    types_1.StageLinqValue.EngineDeck4TrackTrackData,
    types_1.StageLinqValue.EngineDeck4TrackTrackName,
    types_1.StageLinqValue.EngineDeck4CurrentBPM,
    types_1.StageLinqValue.EngineDeck4ExternalMixerVolume,
    types_1.StageLinqValue.ClientPreferencesLayerA,
    types_1.StageLinqValue.ClientPreferencesPlayer,
    types_1.StageLinqValue.ClientPreferencesPlayerJogColorA,
    types_1.StageLinqValue.ClientPreferencesPlayerJogColorB,
    types_1.StageLinqValue.EngineDeck1DeckIsMaster,
    types_1.StageLinqValue.EngineDeck2DeckIsMaster,
    types_1.StageLinqValue.EngineMasterMasterTempo,
    types_1.StageLinqValue.EngineSyncNetworkMasterStatus,
    types_1.StageLinqValue.MixerChannelAssignment1,
    types_1.StageLinqValue.MixerChannelAssignment2,
    types_1.StageLinqValue.MixerChannelAssignment3,
    types_1.StageLinqValue.MixerChannelAssignment4,
    types_1.StageLinqValue.MixerNumberOfChannels,
];
const MAGIC_MARKER = 'smaa';
// FIXME: Is this thing really an interval?
const MAGIC_MARKER_INTERVAL = 0x000007d2;
const MAGIC_MARKER_JSON = 0x00000000;
class StateMap extends Service_1.Service {
    async init() {
        for (const state of exports.States) {
            await this.subscribeState(state, 0);
        }
    }
    parseData(p_ctx) {
        const marker = p_ctx.getString(4);
        (0, assert_1.strict)(marker === MAGIC_MARKER);
        const type = p_ctx.readUInt32();
        switch (type) {
            case MAGIC_MARKER_JSON: {
                const name = p_ctx.readNetworkStringUTF16();
                const json = JSON.parse(p_ctx.readNetworkStringUTF16());
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
            default:
                break;
        }
        assert_1.strict.fail(`Unhandled type ${type}`);
        return null;
    }
    messageHandler(_) {
        // Logger.debug(
        //   `${p_data.message.name} => ${
        //     p_data.message.json ? JSON.stringify(p_data.message.json) : p_data.message.interval
        //   }`
        // );
    }
    async subscribeState(p_state, p_interval) {
        // Logger.log(`Subscribe to state '${p_state}'`);
        const getMessage = function () {
            const ctx = new WriteContext_1.WriteContext();
            ctx.writeFixedSizedString(MAGIC_MARKER);
            ctx.writeUInt32(MAGIC_MARKER_INTERVAL);
            ctx.writeNetworkStringUTF16(p_state);
            ctx.writeUInt32(p_interval);
            return ctx.getBuffer();
        };
        const message = getMessage();
        {
            const ctx = new WriteContext_1.WriteContext();
            ctx.writeUInt32(message.length);
            const written = await this.connection.write(ctx.getBuffer());
            (0, assert_1.strict)(written === 4);
        }
        {
            const written = await this.connection.write(message);
            (0, assert_1.strict)(written === message.length);
        }
    }
}
exports.StateMap = StateMap;
//# sourceMappingURL=StateMap.js.map