import EventEmitter = require("events");
import { StageLinq } from '../StageLinq';
import { Player, PlayerOptions }  from '../status/Player';
import {  PlayerStatus } from '../types';
import { DeviceId} from '../devices'


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
    private _players: Map<string, Player> = new Map();

    constructor(parent: InstanceType<typeof StageLinq>) {
        super();
        this.parent = parent;
    }

    addPlayer(options: PlayerOptions) {
        const player = new Player(options)
        this._players.set(options.deviceId.string, player);
        player.on("nowPlaying", (status) =>{
            this.emit("nowPlaying", status);
        })
        player.on("stateChanged", (status) =>{
            this.emit("stateChanged", status);
        })
        player.on("trackLoaded", (status) =>{
            this.emit("trackLoaded", status);
        })
    }
}