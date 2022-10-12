/*
import { strict as assert } from 'assert';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service } from './Service';
//import { Logger } from '../LogEmitter';
import { ServiceMessage, Tokens, deviceIdFromBuff } from '../types';
import { Logger } from '../LogEmitter';


export interface TimeSyncData {
	msgs: bigint[],
    timestamp: bigint,
}

export declare interface TimeSynchronization {
    on(event: 'message', listener: (message: TimeSyncData) => void): this;
  }

export class TimeSynchronization extends Service<TimeSyncData> {
	private _hasReplied: boolean = false;
	
	async init() {
		
	}

	public async sendTimeSyncRequest() {
		const ctx = new WriteContext();
		ctx.write(new Uint8Array([0x0,0x0,0x0,0x0]));
        ctx.write(Tokens.SoundSwitch);
        ctx.write(new Uint8Array([0x0]));
        ctx.writeFixedSizedString('TimeSynchronization');
		await this.write(ctx);
	}

    private timeSyncMsgHelper(msgId: number, msgs: bigint[]): Buffer {
        const getMessage = function (): Buffer {
            const ctx = new WriteContext();
            ctx.writeUInt32(msgId); 
            while (msgs.length) {
                ctx.writeUInt64(msgs.shift())
            }
            return ctx.getBuffer()
        }
        const message = getMessage();
        
        const ctx = new WriteContext();
        ctx.writeUInt32(message.length);
        ctx.write(message);
        return ctx.getBuffer()
    }
    private getTimeStamp(): bigint {
        const timestamp = Date.now();
        return (BigInt(timestamp) * 1000000n)
    }

    private async sendTimeSyncReply(interval: bigint, timeReceived: bigint): Promise<void> {
       // const currentTime = Date.now();
        const buffMsg = this.timeSyncMsgHelper(2,[interval,timeReceived]);
        Logger.debug(buffMsg);
        await this.connection.write(buffMsg);
        //const buffMsg2 = this.timeSyncMsgHelper(1,[this.getTimeStamp()]);
        //await this.connection.write(buffMsg2);
        //assert(written === 4);
        
        
        //let result = await this.write(ctx);
        
        //Logger.debug(ctx.getBuffer());
        //assert(result === ctx.tell())

    };

	protected parseData(p_ctx: ReadContext): ServiceMessage<TimeSyncData> {
		const timestamp = this.getTimeStamp()
        
        const size = p_ctx.readUInt32();
           
        if (size === 0) {
            const token = p_ctx.read(16);
            const svcName = p_ctx.readNetworkStringUTF16();
            const svcPort = p_ctx.readUInt16();
            console.log(deviceIdFromBuff(token), svcName, svcPort)
        } else {
            const id = p_ctx.readUInt32();
		    const msgs: bigint[] = []
            while (p_ctx.sizeLeft()) {
                msgs.push(p_ctx.readUInt64())
            };
            console.log(size,id,msgs)
            return {
                id: id,
                message: {
                    msgs: msgs,
                    timestamp: timestamp,
                }  
            }
        }
	}

	protected messageHandler(msg: ServiceMessage<TimeSyncData>): void {
		console.log(msg)
        

       // if (!this._hasReplied) {
           // this.sendTimeSyncReply(msg.message.msgs.shift(), msg.message.timestamp)
           // this._hasReplied = true;
      //  }



        switch (msg.id) {
            case 1:
                //Logger.debug('Sending Reply');
                //try {
                   // this.sendTimeSyncReply(msg.message.msgs.shift())
                //} catch(err) {
                //    Logger.error(err)
               // }
            break;
            case 2:
                //Logger.debug('Sending Reply');
                //try {
                   // this.sendTimeSyncReply(msg.message.msgs.shift())
                //} catch(err) {
                   // Logger.error(err)
                //}
            break;

	    }
    }
}
*/