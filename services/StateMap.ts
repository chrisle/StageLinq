import { strict as assert } from 'assert';
import { StageLinqValue } from '../common';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service } from './Service';

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
	StageLinqValue.EngineDeck4ExternalMixerVolume,
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
		for (const state of States) {
			await this.subscribeState(state, 0);
		}
	}

	protected parseData(p_ctx: ReadContext): ServiceMessage<StateData> {
		const marker = p_ctx.getString(4);
		assert(marker === MAGIC_MARKER);

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
		assert.fail(`Unhandled type ${type}`);
		return null;
	}

	protected messageHandler(p_data: ServiceMessage<StateData>): void {
		console.log(
			`${p_data.message.name} => ${
				p_data.message.json ? JSON.stringify(p_data.message.json) : p_data.message.interval
			}`
		);

		if (p_data.message.name.includes('TrackNetworkPath')) {
			const path = this.controller.getAlbumArtPath(p_data.message.json.string);

			// Now pretend as if this is a value outputted by the device
			if (path) {
				console.log(
					`${p_data.message.name.replace(
						'TrackNetworkPath',
						'TrackLocalAlbumArtPath'
					)} => {"string": "${path}", "type":0}`
				);
			} else {
				console.log(
					`${p_data.message.name.replace(
						'TrackNetworkPath',
						'TrackLocalAlbumArtPath'
					)} => {"string": null, "type":-1}`
				);
			}
		}
	}

	private async subscribeState(p_state: string, p_interval: number) {
		//console.log(`Subscribe to state '${p_state}'`);
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
			const written = await this.connection.write(ctx.getBuffer());
			assert(written === 4);
		}
		{
			const written = await this.connection.write(message);
			assert(written === message.length);
		}
	}
}
