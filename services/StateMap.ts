import { strict as assert } from 'assert';
import { StageLinqValue, STATE_MESSAGE_MARKER } from "../common";
import { ReadContext } from "../utils/ReadContext";
import { WriteContext } from "../utils/WriteContext";
import { Service } from "./Service";

export const States = [
	// Mixer
	StageLinqValue.MixerCH1faderPosition,
	StageLinqValue.MixerCH2faderPosition,
	StageLinqValue.MixerCrossfaderPosition,

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
	StageLinqValue.EngineDeck4ExternalMixerVolume

];

export interface StateData {
	name: string,
	json: object
}

export class StateMap extends Service {
	async init() {
		for (const state of States) {
			await this.subscribeState(state, 0);
		}
	}

	parseData(p_ctx: ReadContext): StateData {
		p_ctx.seek(8); // FIXME: Verify magic bytes
		const name = p_ctx.readNetworkStringUTF16();
		const json = JSON.parse(p_ctx.readNetworkStringUTF16());

		return {
			name: name,
			json: json
		};
	}

	private async subscribeState(p_state: string, p_interval: number) {
		console.info(`Subscribe to state '${p_state}'`);
		const getMessage = function(): Buffer {
			const ctx = new WriteContext({littleEndian: false});
			ctx.write(STATE_MESSAGE_MARKER);
			ctx.writeNetworkStringUTF16(p_state);
			ctx.writeUInt32(p_interval);
			return ctx.getBuffer();
		}

		const message = getMessage();
		{
			const ctx = new WriteContext({littleEndian: false});
			ctx.writeUInt32(message.length);
			const written = await this.connection.write(ctx.getBuffer());
			assert(written === 4);
		}
		{
			const written = await this.connection.write(message);
			assert(written === message.length);
		}
	}
}