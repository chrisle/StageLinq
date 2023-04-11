
import { EventEmitter } from 'events';
//import { Logger } from '../LogEmitter';
//import { performance } from 'perf_hooks';
import { ReadContext } from '../utils';
import { ServiceMessage } from '../types';
import { DeviceId } from '../devices'
import { Service } from './Service';
import { StageLinq } from '../StageLinq';
// import { StageLinq } from '../StageLinq';


export type BroadcastMessage = {
    //name: string,
    databaseUuid: string,
    trackId?: number | string,
    listId?: number | string,
    sessionId?: number | string,
}

export interface BroadcastData {
    [key: string]: any //{
    //     databaseUuid: string;
    //     trackId?: string | number;
    //     listId?: string | number;
    // }
}

// export declare interface Broadcast {
//     on(event: 'message', listener: (deviceId: DeviceId, data: BroadcastMessage) => void): this;
//     on(event: 'newDevice', listener: () => void): this;
//   }


export class Broadcast extends Service<BroadcastData> {
    public readonly name = "Broadcast"
    protected readonly isBufferedService: boolean = false;
    static readonly emitter: EventEmitter = new EventEmitter();

    protected parseData(p_ctx: ReadContext): ServiceMessage<BroadcastData> {

        const length = p_ctx.readUInt32();
        if (!length && p_ctx.sizeLeft()) {
            return {
                id: length,
                message: {
                    deviceId: new DeviceId(p_ctx.read(16)),
                    name: p_ctx.readNetworkStringUTF16(),
                    port: p_ctx.readUInt16(),
                    sizeLeft: p_ctx.sizeLeft()
                }
            }
        } else {
            return {
                id: length,
                message: {
                    json: p_ctx.getString(length),
                    sizeLeft: p_ctx.sizeLeft()
                }
            }
        }
    }


    protected messageHandler(data: ServiceMessage<BroadcastData>): void {
        if (data?.id === 0) {
            StageLinq.devices.emit('newService', this.device, this)
        }

        if (data?.message?.json) {
            const msg = JSON.parse(data.message.json.replace(/\./g, ""));
            const key = Object.keys(msg).shift()
            const value = Object.values(msg).shift() as BroadcastMessage;
            //const source = StageLinq.sources.getSourceByDbId(value.databaseUuid)
            //console.warn(source.name, source.database.dbId);

            //const dbEntry = source.database.local.connection.getTrackByID(parseInt(value.trackId as string))
            Broadcast.emitter.emit('message', this.deviceId, key, value)

            if (Broadcast.emitter.listenerCount(value.databaseUuid)) {
                Broadcast.emitter.emit(value.databaseUuid, key, value);
            }
        }
    }
}