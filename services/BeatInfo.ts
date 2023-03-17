import { strict as assert } from 'assert';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service, ServiceHandler } from './Service';
import { Logger } from '../LogEmitter';
import type { ServiceMessage, DeviceId } from '../types';
import { Socket } from 'net';

type beatCallback = (n: BeatData) => void;

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
export class BeatInfoHandler extends ServiceHandler<BeatData> {
	public name: string = 'BeatInfo'
  
	public setupService(service: Service<BeatData>, deviceId: DeviceId) {
		Logger.debug(`Setting up ${service.name} for ${deviceId.toString()}`);
		const beatInfo = service as BeatInfo;
		this.addDevice(deviceId, service);
		
		// Just a counter to test resolution
		let beatCalls: number = 0;  
		//  User callback function. 
		//  Will be triggered everytime a player's beat counter crosses the resolution threshold
		function beatCallback(bd: BeatData) {
		let deckBeatString = ""
		for (let i=0; i<bd.deckCount; i++) {
			deckBeatString += `Player: ${i+1} Beat: ${bd.deck[i].beat.toFixed(3)} `
		}
		console.warn(`Total Calls ${beatCalls} ${deckBeatString}`);
		beatCalls++
		}
		//  User Options
		const beatOptions = {
		everyNBeats: 1, // 1 = every beat, 4 = every 4 beats, .25 = every 1/4 beat
		}
		//  Start BeatInfo, pass user callback
		beatInfo.server.on("connection", (socket) =>{ 
			beatInfo.startBeatInfo(beatCallback, beatOptions, socket);
		}); 
	}
  }

export declare interface BeatInfo {
    on(event: 'message', listener: (message: BeatData) => void): this;
  }

export class BeatInfo extends Service<BeatData> {
    public name: string = "BeatInfo";

	private _userBeatCallback: beatCallback = null;
	private _userBeatOptions: BeatOptions = null;
	private _currentBeatData: BeatData = null;    
	
	async init() {}

	public async startBeatInfo(beatCB: beatCallback, options: BeatOptions, socket?: Socket) {
		this._userBeatCallback = beatCB;
		this._userBeatOptions = options;
		
        this.sendBeatInfoRequest(socket);
	}

	private async sendBeatInfoRequest(socket: Socket) {
		const ctx = new WriteContext();
		ctx.write(new Uint8Array([0x0,0x0,0x0,0x4,0x0,0x0,0x0,0x0]))
		await this.write(ctx, socket);
	}

	protected parseData(p_ctx: ReadContext): ServiceMessage<BeatData> {
		assert(p_ctx.sizeLeft() > 72);
		let id = p_ctx.readUInt32()
		const clock = p_ctx.readUInt64();
		const deckCount = p_ctx.readUInt32();
		let deck: deckBeatData[] = [];
		for (let i=0; i<deckCount; i++) {
			let deckData:deckBeatData = {
				beat: p_ctx.readFloat64(),
				totalBeats: p_ctx.readFloat64(),
				BPM: p_ctx.readFloat64(),
			}
			deck.push(deckData);
		}
		for (let i=0; i<deckCount; i++) {
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
        if (p_data && p_data.message) {
            function resCheck(res: number, prevBeat: number, currentBeat: number ) {
                return ( Math.floor(currentBeat/res) - Math.floor(prevBeat/res)  >= 1) 
                    || (  Math.floor(prevBeat/res) - Math.floor(currentBeat/res)   >= 1)	
            }
    
            if (!this._currentBeatData) {
                this._currentBeatData = p_data.message
                this._userBeatCallback(p_data.message);
            } 
    
            let hasUpdated = false;
            for (let i = 0; i<p_data.message.deckCount; i++) {
                if (resCheck(
                        this._userBeatOptions.everyNBeats, 
                        this._currentBeatData.deck[i].beat, 
                        p_data.message.deck[i].beat)) {
                    hasUpdated = true;
                }
            }
            if (hasUpdated) {
                this._currentBeatData = p_data.message;
                this._userBeatCallback(p_data.message);
            }
        }
	}
	
    protected parseServiceData(messageId:number, deviceId: DeviceId, serviceName: string, socket: Socket): ServiceMessage<BeatData> {
		assert((socket));
		Logger.silly(`${messageId} to ${serviceName} from ${deviceId.toString()}`)
		return
      }
}