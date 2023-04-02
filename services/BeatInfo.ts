import { strict as assert } from 'assert';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service, ServiceHandler } from './Service';
import { Logger } from '../LogEmitter';
import type { ServiceMessage } from '../types';
import { DeviceId } from '../devices'
import { Socket } from 'net';
import { StageLinq } from '../StageLinq';

type BeatCallback = (n: ServiceMessage<BeatData>) => void;

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
	#beatRegister: Map<string, BeatData> = new Map();

	/**
	 * Get most recent BeatData
	 * @param {DeviceId} [deviceId] optionally filter by DeviceId
	 * @returns {BeatData[]}
	 */
	public getBeatData(deviceId?: DeviceId): BeatData[] {
		return (deviceId ? [this.#beatRegister.get(deviceId.string)] : [...this.#beatRegister.values()])
	}

	/**
	 * Add BeatData for Device
	 * @param {DeviceId} deviceId 
	 * @param {BeatData} data 
	 */
	public setBeatData(deviceId: DeviceId, data: BeatData) {
		this.#beatRegister.set(deviceId.string, data);
	}

	/**
	 * Setup BeatInfo ServiceHandler
	 * @param {Service<BeatData>} service 
	 * @param {DeviceId} deviceId 
	 */
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

	private _userBeatCallback: BeatCallback = null;
	private _userBeatOptions: BeatOptions = null;
	private _currentBeatData: ServiceMessage<BeatData> = null;
	isBufferedService: boolean = true;

	/**
	 * @constructor
	 * @param {StageLinq} parent 
	 * @param {BeatInfoHandler} serviceHandler 
	 * @param {DeviceId} [deviceId] 
	 */
	constructor(parent: InstanceType<typeof StageLinq>, serviceHandler: BeatInfoHandler, deviceId?: DeviceId) {
		super(parent, serviceHandler, deviceId)
		this.handler = this._handler as BeatInfoHandler
	}

	/**
	 * Get current BeatData
	 * @returns {ServiceMessage<BeatData>}
	 */
	getBeatData(): ServiceMessage<BeatData> {
		return this._currentBeatData;
	}

	/**
	 * Start BeatInfo
	 * @param {BeatOptions} options 
	 * @param {BeatCallback} [beatCB] Optional User callback
	 */
	public startBeatInfo(options: BeatOptions, beatCB?: BeatCallback) {
		if (beatCB) {
			this._userBeatCallback = beatCB;
		}
		this._userBeatOptions = options;
		this.sendBeatInfoRequest();
	}

	/**
	 * Send Subscribe to BeatInfo message to Device
	 * @param {Socket} socket 
	 */
	private async sendBeatInfoRequest() {
		const ctx = new WriteContext();
		ctx.write(new Uint8Array([0x0, 0x0, 0x0, 0x4, 0x0, 0x0, 0x0, 0x0]))
		await this.write(ctx);
	}

	protected parseData(ctx: ReadContext, socket: Socket): ServiceMessage<BeatData> {
		assert(ctx.sizeLeft() > 72);
		let id = ctx.readUInt32()
		const clock = ctx.readUInt64();
		const deckCount = ctx.readUInt32();
		let deck: deckBeatData[] = [];
		for (let i = 0; i < deckCount; i++) {
			let deckData: deckBeatData = {
				beat: ctx.readFloat64(),
				totalBeats: ctx.readFloat64(),
				BPM: ctx.readFloat64(),
			}
			deck.push(deckData);
		}
		for (let i = 0; i < deckCount; i++) {
			deck[i].samples = ctx.readFloat64();
		}
		assert(ctx.isEOF())
		const beatMsg = {
			clock: clock,
			deckCount: deckCount,
			deck: deck,
		}
		return {
			id: id,
			deviceId: this.deviceId,
			socket: socket,
			message: beatMsg
		}
	}

	protected messageHandler(data: ServiceMessage<BeatData>): void {

		function resCheck(res: number, prevBeat: number, currentBeat: number): boolean {
			if (res === 0) {
				return true
			}
			return (Math.floor(currentBeat / res) - Math.floor(prevBeat / res) >= 1)
				|| (Math.floor(prevBeat / res) - Math.floor(currentBeat / res) >= 1)
		}

		if (data && data.message) {
			if (!this._currentBeatData) {
				this._currentBeatData = data;
				this.handler.setBeatData(this.deviceId, data.message);
				this.emit('beatMessage', data);
				if (this._userBeatCallback) {
					this._userBeatCallback(data);
				}
			}

			let hasUpdated = false;

			for (let i = 0; i < data.message.deckCount; i++) {
				if (resCheck(
					this._userBeatOptions.everyNBeats,
					this._currentBeatData.message.deck[i].beat,
					data.message.deck[i].beat)) {
					hasUpdated = true;
				}
			}

			if (hasUpdated) {

				this.emit('beatMessage', data);
				if (this._userBeatCallback) {
					this._userBeatCallback(data);
				}
			}
			this._currentBeatData = data;
			this.handler.setBeatData(this.deviceId, data.message);
		}
	}

}