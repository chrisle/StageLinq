import EventEmitter = require("events");
import { StageLinq } from '../StageLinq';
import { StateData, StateMap } from '../services';
import { TrackData } from '../types';
import { DeviceId } from '../devices'


export class Status extends EventEmitter {
    readonly parent: InstanceType<typeof StageLinq>;
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

    private getTypedValue(data: StateData): boolean | string | number {
        if (data.json.state) {
            return data.json.state as boolean
        }
        if (data.json.string) {
            return data.json.string as string
        }
        if (data.json.value) {
            return data.json.value as number
        }
    }

    private listener(data: StateData, status: Status) {
        const deck = parseInt(data.name.substring(12, 13))
        const property = data.name.split('/').pop()
        const value = this.getTypedValue(data);
        const track = status.tracks.get(`{${data.deviceId.string}},${deck}`)
        this.tracks.set(`{${data.deviceId.string}},${deck}`, Object.assign(track, { [property]: value }));
    }

}