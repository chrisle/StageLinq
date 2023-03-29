import { strict as assert } from 'assert';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service, ServiceHandler } from './Service';
import { Logger } from '../LogEmitter';
import type { ServiceMessage } from '../types';
import { DeviceId } from '../devices'
import { Socket } from 'net';
import { StageLinq } from '../StageLinq';

type beatCallback = (n: ServiceMessage<BeatData>) => void;

type BeatOptions = {
	everyNBeats: number,
}

interface deckBeatData {
	beat: number;
	totalBeats: number;
	BPM: number;
	samples?: number;
}

export interface BeatData {
	clock: bigint;
	deckCount: number;
	deck: deckBeatData[];
}

export declare interface BeatInfoHandler {
	on(event: 'newBeatInfoDevice', listener: (device: Service<BeatData>) => void): this;
	on(event: 'beatMsg', listener: (beatData: ServiceMessage<BeatData>, device: Service<BeatData>) => void): this;
}

export class BeatInfoHandler extends ServiceHandler<BeatData> {
	public name: string = 'BeatInfo';
	private _beatregister: Map<string, BeatData> = new Map();

	getBeatData(deviceId?: DeviceId): BeatData[] {
		return (deviceId? [this._beatregister.get(deviceId.string)] : [...this._beatregister.values()])
	}

	setBeatData(deviceId: DeviceId, data: BeatData) {
		this._beatregister.set(deviceId.string, data);
	}

	public setupService(service: Service<BeatData>, deviceId: DeviceId) {
		Logger.debug(`Setting up ${service.name} for ${deviceId.string}`);
		const beatInfo = service as BeatInfo;
		this.addDevice(deviceId, service);

		beatInfo.server.on("connection", () => {
			this.emit('newBeatInfoDevice', beatInfo)
		});
		beatInfo.on('beatMessage', (message: ServiceMessage<BeatData>) => {
			this.emit('beatMsg', message, beatInfo)
		})
	}
}

export declare interface BeatInfo {
	on(event: 'beatMessage', listener: (message: ServiceMessage<BeatData>) => void): this;
}

export class BeatInfo extends Service<BeatData> {
	public readonly name = "BeatInfo";
	public readonly handler: BeatInfoHandler;

	private _userBeatCallback: beatCallback = null;
	private _userBeatOptions: BeatOptions = null;
	private _currentBeatData: ServiceMessage<BeatData> = null;
	isBufferedService: boolean = true;
	
	constructor(p_parent: InstanceType<typeof StageLinq>, serviceHandler: BeatInfoHandler, deviceId?: DeviceId) {
		super(p_parent, serviceHandler, deviceId)
		this.handler = this._handler as BeatInfoHandler
	  }

	getBeatData(): ServiceMessage<BeatData> {
		return this._currentBeatData;
	}

	

	public async startBeatInfo(options: BeatOptions, beatCB?: beatCallback,) {
		if (beatCB) {
			this._userBeatCallback = beatCB;
		}
		this._userBeatOptions = options;
		this.sendBeatInfoRequest(this.socket);
	}

	private async sendBeatInfoRequest(socket: Socket) {
		const ctx = new WriteContext();
		ctx.write(new Uint8Array([0x0, 0x0, 0x0, 0x4, 0x0, 0x0, 0x0, 0x0]))
		await this.write(ctx, socket);
	}

	protected parseData(p_ctx: ReadContext): ServiceMessage<BeatData> {
		assert(p_ctx.sizeLeft() > 72);
		let id = p_ctx.readUInt32()
		const clock = p_ctx.readUInt64();
		const deckCount = p_ctx.readUInt32();
		let deck: deckBeatData[] = [];
		for (let i = 0; i < deckCount; i++) {
			let deckData: deckBeatData = {
				beat: p_ctx.readFloat64(),
				totalBeats: p_ctx.readFloat64(),
				BPM: p_ctx.readFloat64(),
			}
			deck.push(deckData);
		}
		for (let i = 0; i < deckCount; i++) {
			deck[i].samples = p_ctx.readFloat64();
		}
		assert(p_ctx.isEOF())
		const beatMsg = {
			clock: clock,
			deckCount: deckCount,
			deck: deck,
		}
		return {
			id: id,
			deviceId: this.deviceId,
			socket: this.socket,
			message: beatMsg
		}
	}

	protected messageHandler(p_data: ServiceMessage<BeatData>): void {

		function resCheck(res: number, prevBeat: number, currentBeat: number): boolean {
			if (res === 0) {
				return true
			}
			return (Math.floor(currentBeat / res) - Math.floor(prevBeat / res) >= 1)
				|| (Math.floor(prevBeat / res) - Math.floor(currentBeat / res) >= 1)
		}

		if (p_data && p_data.message) {
			if (!this._currentBeatData) {
				this._currentBeatData = p_data;
				this.handler.setBeatData(this.deviceId, p_data.message);
				this.emit('beatMessage', p_data);
				if (this._userBeatCallback) {
					this._userBeatCallback(p_data);
				}
			}

			let hasUpdated = false;

			for (let i = 0; i < p_data.message.deckCount; i++) {
				if (resCheck(
					this._userBeatOptions.everyNBeats,
					this._currentBeatData.message.deck[i].beat,
					p_data.message.deck[i].beat)) {
					hasUpdated = true;
				}
			}

			if (hasUpdated) {
				
				this.emit('beatMessage', p_data);
				if (this._userBeatCallback) {
					this._userBeatCallback(p_data);
				}
			}
			this._currentBeatData = p_data;
			this.handler.setBeatData(this.deviceId, p_data.message);
		}
	}

	protected parseServiceData(messageId: number, deviceId: DeviceId, serviceName: string, socket: Socket): ServiceMessage<BeatData> {
		assert((socket));
		Logger.silly(`${messageId} to ${serviceName} from ${deviceId.string}`)
		return
	}
}