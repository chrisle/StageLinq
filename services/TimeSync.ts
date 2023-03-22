
import { strict as assert } from 'assert';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service, ServiceHandler } from './Service';
import * as Services from '../services';
//import { Logger } from '../LogEmitter';
import { ServiceMessage, Tokens, DeviceId } from '../types';
import { Logger } from '../LogEmitter';
import { Socket } from 'net';
const { performance } = require('perf_hooks');


export interface TimeSyncData {
	msgs: bigint[],
    timestamp: bigint,
}

// export declare interface TimeSync {
//     //on(event: 'message', listener: (message: TimeSyncData) => void): this;
// }

export class TimeSynchronizationHandler extends ServiceHandler<TimeSyncData> {
    public name: string = 'TimeSync'

    public setupService(service: TimeSynchronization, deviceId: DeviceId) {
        console.log(`Setting up ${service.name} for ${deviceId.toString()}`);
        
        service.on('newDevice',  ( _service: InstanceType<typeof Services.TimeSynchronization>) => {
            Logger.debug(`New TimeSync Device ${service.deviceId.toString()}`)
            //this.emit('newDevice',  service);
            _service.sendTimeSyncRequest();
          })
        
    }
}

export class TimeSynchronization extends Service<TimeSyncData> {
	public name:string = "TimeSynchronization"
    protected isBufferedService: boolean = false;
    private localTime: bigint;
    private remoteTime: bigint;
    private avgTimeArray: bigint[] = [];
    //private queryTimer: NodeJS.Timer;
	
	

	public async sendTimeSyncRequest() {
		const ctx = new WriteContext();
		ctx.write(new Uint8Array([0x0,0x0,0x0,0x0]));
        ctx.write(Tokens.Listen);
        ctx.write(new Uint8Array([0x0]));
        ctx.writeFixedSizedString('TimeSynchronization');
		await this.write(ctx, this.socket);
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
        //const timestamp = Math.floor(performance.now() * 1000000); //Date.now();
        return (BigInt(Math.floor(performance.now())))
    }


    private sendTimeSyncQuery(localTime: bigint, remoteTime: bigint) {
        this.localTime = localTime;
        //this.currrentTime = currentTime;
        const buffMsg = this.timeSyncMsgHelper(1,[this.localTime]);
        const ctx = new WriteContext()
        ctx.write(buffMsg)
        //Logger.debug(buffMsg);
        this.remoteTime = remoteTime;
        this.write(ctx, this.socket);
     };

    // private async sendTimeSyncReply(interval: bigint, timeReceived: bigint): Promise<void> {
    //     const buffMsg = this.timeSyncMsgHelper(2,[interval,timeReceived]);
    //     const ctx = new WriteContext()
    //     ctx.write(buffMsg)
    //     await this.write(ctx, this.socket);
    // };

	protected parseData(p_ctx: ReadContext): ServiceMessage<TimeSyncData> {
		const timestamp = this.getTimeStamp()
        //console.log(performance.now())
        
        //console.log(p_ctx.readRemainingAsNewBuffer())
        //p_ctx.rewind();
        const size = p_ctx.readUInt32();
           
       // console.log(timestamp, size)

        if (size === 0) {
            const token = p_ctx.read(16);
            const deviceId = new DeviceId(token)
            const svcName = p_ctx.readNetworkStringUTF16();
            const svcPort = p_ctx.readUInt16();
            console.log(deviceId.toString(), svcName, svcPort)
        } else {
            const id = p_ctx.readUInt32();
		    const msgs: bigint[] = []
            while (p_ctx.sizeLeft()) {
                msgs.push(p_ctx.readUInt64())
            };
            //console.log(this.deviceId.toString(), size,id,msgs)
            return {
                id: id,
                deviceId: this.deviceId,
                socket: this.socket,
                message: {
                    msgs: msgs,
                    timestamp: timestamp,
                }  
            }
        }
	}

    private timeAvg(time: bigint) {
        //const timeInt = Number(time);
        if (this.avgTimeArray.length > 100) {
            this.avgTimeArray.shift();
            this.avgTimeArray.push(time);
            const sum = this.avgTimeArray.reduce((a, b) => a + b, 0n);
            const avg = (sum / BigInt(this.avgTimeArray.length)) || 0;
            console.log(`${this.deviceId.toString()} Average time ${Number(avg)}`)
        } else {
            this.avgTimeArray.push(time);
            //console.log(this.avgTimeArray.length)
        }
    } 

	protected messageHandler(msg: ServiceMessage<TimeSyncData>): void {
		//console.log(msg.message)
        
        if (!msg?.message) {
            return
        }
        if (msg?.deviceId && msg?.deviceId.toString() != "4be14112-5ead-4848-a07d-b37ca8a7220e") {
           // return
        }

       // if (!this._hasReplied) {
        //this.sendTimeSyncReply(msg.message.msgs.shift(), msg.message.timestamp)
           // this._hasReplied = true;
      //  }

        //console.log(performance.now())

        switch (msg.id) {
            case 1:
                //console.log(msg.deviceId.toString(), msg.message.msgs[0])

                //this.remoteTime = msg.message.msgs.shift();
                this.sendTimeSyncQuery(msg.message.timestamp, msg.message.msgs.shift());  
                
            break;
            case 2:
            console.log(msg.message)    
            const localClock =  msg.message.timestamp - msg.message.msgs[0] 
                const remoteClock =  msg.message.msgs[1] - this.remoteTime
                
                console.log(msg.deviceId.toString(), localClock, remoteClock, (localClock - remoteClock))    
                this.timeAvg(remoteClock)
            
            break;

	    }
    }

    protected parseServiceData(messageId:number, deviceId: DeviceId, serviceName: string, socket: Socket): ServiceMessage<TimeSyncData> {
		assert((socket));
		Logger.silly(`${messageId} to ${serviceName} from ${deviceId.toString()}`)
        this.emit('newDevice', this)
		return
      }
}

