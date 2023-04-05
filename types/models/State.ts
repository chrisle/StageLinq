import { DeviceId } from "../../devices";

interface ITrackData {
    source: {
        name: string;
        location: DeviceId;
        path: string;
    }
    ArtistName: string;
    Bleep: boolean;
    CuePosition: number;
    CurrentBPM: number;
    CurrentKeyIndex: number;
    CurrentLoopInPosition: number;
    CurrentLoopOutPosition: number;
    CurrentLoopSizeInBeats: number;
    KeyLock: boolean;
    LoopEnableState: boolean;
    Loop: {
        QuickLoop1: boolean;
        QuickLoop2: boolean;
        QuickLoop3: boolean;
        QuickLoop4: boolean;
        QuickLoop5: boolean;
        QuickLoop6: boolean;
        QuickLoop7: boolean;
        QuickLoop8: boolean;
    },
    PlayPauseLEDState: boolean;
    SampleRate: number;
    SongAnalyzed: boolean;
    SongLoaded: boolean;
    SongName: string;
    SoundSwitchGUID: string;
    TrackBytes: number;
    TrackData: boolean;
    TrackLength: number;
    TrackName: string;
    TrackNetworkPath: string;
    TrackURI: string;
    TrackWasPlayed: boolean;
}

export class TrackData implements Partial<ITrackData> {
    #prefix: string;
    #source: {
        name: string;
        location: DeviceId;
        path: string;
    } = null;

    ArtistName: string = ""
    CurrentBPM: number = 0;
    SampleRate: number = 0;
    SongAnalyzed: boolean = false;
    SongLoaded: boolean = false;
    SongName: string = "";
    SoundSwitchGUID: string = "";
    TrackBytes: number = 0;
    TrackLength: number = 0;
    TrackName: string = "";
    TrackNetworkPath: string = "";
    TrackURI: string = "";

    /**
     * @constructor
     * @param {string} prefix State prefix that should proceed the property
     */
    constructor(prefix: string) {
        this.#prefix = prefix;
    }

    /**
     * Get State Prefix
     */
    get prefix() {
        return this.#prefix;
    }

    get source() {
        if (this.TrackNetworkPath) {
            const split = this.TrackNetworkPath.substring(6).split('/')
            const deviceId = new DeviceId(split.shift());
            const sourceName = split.shift();
            const path = `/${sourceName}/${split.join('/')}`
            this.#source = {
                name: sourceName,
                location: deviceId,
                path: path,
            }
        }
        return this.#source
    }
}

