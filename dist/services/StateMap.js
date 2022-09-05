"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMap = exports.States = void 0;
const assert_1 = require("assert");
const network_1 = require("../network");
const WriteContext_1 = require("../utils/WriteContext");
const Service_1 = require("./Service");
exports.States = [
    // Mixer
    network_1.StageLinqValue.MixerCH1faderPosition,
    network_1.StageLinqValue.MixerCH2faderPosition,
    network_1.StageLinqValue.MixerCrossfaderPosition,
    // Decks
    network_1.StageLinqValue.EngineDeck1Play,
    network_1.StageLinqValue.EngineDeck1PlayState,
    network_1.StageLinqValue.EngineDeck1PlayStatePath,
    network_1.StageLinqValue.EngineDeck1TrackArtistName,
    network_1.StageLinqValue.EngineDeck1TrackTrackNetworkPath,
    network_1.StageLinqValue.EngineDeck1TrackSongLoaded,
    network_1.StageLinqValue.EngineDeck1TrackSongName,
    network_1.StageLinqValue.EngineDeck1TrackTrackData,
    network_1.StageLinqValue.EngineDeck1TrackTrackName,
    network_1.StageLinqValue.EngineDeck1CurrentBPM,
    network_1.StageLinqValue.EngineDeck1ExternalMixerVolume,
    network_1.StageLinqValue.EngineDeck2Play,
    network_1.StageLinqValue.EngineDeck2PlayState,
    network_1.StageLinqValue.EngineDeck2PlayStatePath,
    network_1.StageLinqValue.EngineDeck2TrackArtistName,
    network_1.StageLinqValue.EngineDeck2TrackTrackNetworkPath,
    network_1.StageLinqValue.EngineDeck2TrackSongLoaded,
    network_1.StageLinqValue.EngineDeck2TrackSongName,
    network_1.StageLinqValue.EngineDeck2TrackTrackData,
    network_1.StageLinqValue.EngineDeck2TrackTrackName,
    network_1.StageLinqValue.EngineDeck2CurrentBPM,
    network_1.StageLinqValue.EngineDeck2ExternalMixerVolume,
    network_1.StageLinqValue.EngineDeck3Play,
    network_1.StageLinqValue.EngineDeck3PlayState,
    network_1.StageLinqValue.EngineDeck3PlayStatePath,
    network_1.StageLinqValue.EngineDeck3TrackArtistName,
    network_1.StageLinqValue.EngineDeck3TrackTrackNetworkPath,
    network_1.StageLinqValue.EngineDeck3TrackSongLoaded,
    network_1.StageLinqValue.EngineDeck3TrackSongName,
    network_1.StageLinqValue.EngineDeck3TrackTrackData,
    network_1.StageLinqValue.EngineDeck3TrackTrackName,
    network_1.StageLinqValue.EngineDeck3CurrentBPM,
    network_1.StageLinqValue.EngineDeck3ExternalMixerVolume,
    network_1.StageLinqValue.EngineDeck4Play,
    network_1.StageLinqValue.EngineDeck4PlayState,
    network_1.StageLinqValue.EngineDeck4PlayStatePath,
    network_1.StageLinqValue.EngineDeck4TrackArtistName,
    network_1.StageLinqValue.EngineDeck4TrackTrackNetworkPath,
    network_1.StageLinqValue.EngineDeck4TrackSongLoaded,
    network_1.StageLinqValue.EngineDeck4TrackSongName,
    network_1.StageLinqValue.EngineDeck4TrackTrackData,
    network_1.StageLinqValue.EngineDeck4TrackTrackName,
    network_1.StageLinqValue.EngineDeck4CurrentBPM,
    network_1.StageLinqValue.EngineDeck4ExternalMixerVolume,
    network_1.StageLinqValue.ClientPreferencesLayerA,
    network_1.StageLinqValue.ClientPreferencesPlayer,
    network_1.StageLinqValue.ClientPreferencesPlayerJogColorA,
    network_1.StageLinqValue.ClientPreferencesPlayerJogColorB,
    network_1.StageLinqValue.EngineDeck1DeckIsMaster,
    network_1.StageLinqValue.EngineDeck2DeckIsMaster,
    network_1.StageLinqValue.EngineMasterMasterTempo,
    network_1.StageLinqValue.EngineSyncNetworkMasterStatus,
    network_1.StageLinqValue.MixerChannelAssignment1,
    network_1.StageLinqValue.MixerChannelAssignment2,
    network_1.StageLinqValue.MixerChannelAssignment3,
    network_1.StageLinqValue.MixerChannelAssignment4,
    network_1.StageLinqValue.MixerNumberOfChannels,
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
    messageHandler(p_data) {
        console.log(`${p_data.message.name} => ${p_data.message.json ? JSON.stringify(p_data.message.json) : p_data.message.interval}`);
    }
    async subscribeState(p_state, p_interval) {
        //console.log(`Subscribe to state '${p_state}'`);
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