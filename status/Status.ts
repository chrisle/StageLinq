import EventEmitter = require("events");
import { StageLinq } from '../StageLinq';
import { StateData, StateMap } from '../services';
//import { Player, PlayerOptions } from '../status/Player';
import { PlayerStatus, ServiceMessage, TrackData } from '../types';
import { DeviceId } from '../devices'


export declare interface Status {
    on(event: 'trackLoaded', listener: (status: PlayerStatus) => void): this;
    on(event: 'stateChanged', listener: (status: PlayerStatus) => void): this;
    on(event: 'nowPlaying', listener: (status: PlayerStatus) => void): this;
}

export interface StatusData extends PlayerStatus {
    deviceId: DeviceId
}

export class Status extends EventEmitter {
    readonly parent: InstanceType<typeof StageLinq>;
    //private _players: Map<string, Player> = new Map();
    private tracks: Map<string, TrackData> = new Map();

    /**
     * @constructor
     * @param {StageLinq} parent 
     */
    constructor(parent: InstanceType<typeof StageLinq>) {
        super();
        this.parent = parent;
    }

    /**
     * Add a track to Status
     * @param {StateMap} service // Instance of StateMap Service
     * @param {number} deck Deck (layer) number
     */
    async addTrack(service: StateMap, deck: number,) {
        let track = new TrackData(`/Engine/Deck${deck}/Track/`)
        this.tracks.set(`{${service.deviceId.string}},${deck}`, track)
        for (let item of Object.keys(track)) {
            service.addListener(`${track.prefix}${item}`, data => this.listener(data, this))
        }
    }

    /**
     * Get Track Info from Status
     * @param {DeviceId} deviceId DeviceId of the player
     * @param {deck} deck Deck (layer) number
     * @returns {TrackData}
     */
    getTrack(deviceId: DeviceId, deck: number): TrackData {
        return this.tracks.get(`{${deviceId.string}},${deck}`);
    }

    private getTypedValue(data: ServiceMessage<StateData>): boolean | string | number {
        if (data.message.json.state) {
            return data.message.json.state as boolean
        }
        if (data.message.json.string) {
            return data.message.json.string as string
        }
        if (data.message.json.value) {
            return data.message.json.value as number
        }
    }

    private listener(data: ServiceMessage<StateData>, status: Status) {
        const deck = parseInt(data.message.name.substring(12, 13))
        const property = data.message.name.split('/').pop()
        const value = this.getTypedValue(data);
        const track = status.tracks.get(`{${data.deviceId.string}},${deck}`)
        this.tracks.set(`{${data.deviceId.string}},${deck}`, Object.assign(track, { [property]: value }));
    }




    // addPlayer(options: PlayerOptions) {
    //     const player = new Player(options)
    //     this._players.set(options.deviceId.string, player);
    //     player.on("nowPlaying", (status) => {
    //         this.emit("nowPlaying", status);
    //     })
    //     player.on("stateChanged", (status) => {
    //         this.emit("stateChanged", status);
    //     })
    //     player.on("trackLoaded", (status) => {
    //         this.emit("trackLoaded", status);
    //     })
    // }
}