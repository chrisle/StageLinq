
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


// export const configStates = {
//     Mixer: {
//         Mixer: {
//             ChannelAssignment1: '',
//             ChannelAssignment2: '',
//             ChannelAssignment3: '',
//             ChannelAssignment4: '',
//         },
//     },
//     Player: {
//         Client: {
//             Librarian: {
//                 DevicesController: {
//                     CurrentDevice: '', //type 8 can be URI net://[DEVICEID]/[SOURCENAME] ([LOCATION?]) or /media/[SOURCENAME]
//                     HasSDCardConnected: false,
//                     HasUsbDeviceConnected: false,
//                 },
//             },
//             Preferences: {
//                 LayerB: false,
//                 Player: '', //type 4 ENUM? 
//                 PlayerJogColorA: '#FFFFFF', //type 16 Colour string
//                 PlayerJogColorB: '#FFFFFF',
//                 Profile: {
//                     Application: {
//                         SyncMode: '',
//                     },
//                 },
//             },
//         },
//     }
// }


// export const PlayerStates = {
//     // Gui: {
//     //     ViewLayer: {
//     //         LayerB: 'LayerB',
//     //     },
//     //     Decks: {
//     //         Deck: {
//     //             ActiveDeck: 'ActiveDeck',
//     //         },
//     //     },
//     // },
//     Mixer: {
//         //NumberOfChannels: 'NumberOfChannels', //NG 
//         ChannelAssignment1: '', // type 8 format '{DEVICEID},1' or '{DEVICEID},2'
//         ChannelAssignment2: '',
//         ChannelAssignment3: '',
//         ChannelAssignment4: '',
//     },
//     Engine: {
//         DeckCount: 2, //type 10
//         Sync: {
//             Network: {
//                 MasterStatus: false,
//             },
//         },
//         Master: {
//             MasterTempo: 120.0, //type 0
//         },
//     },
//     Client: {
//         Librarian: {
//             DevicesController: {
//                 CurrentDevice: '', //type 8 can be URI net://[DEVICEID]/[SOURCENAME] ([LOCATION?]) or /media/[SOURCENAME]
//                 HasSDCardConnected: false,
//                 HasUsbDeviceConnected: false,
//             },
//         },
//         Preferences: {
//             LayerB: false,
//             Player: '', //type 4 ENUM? 
//             PlayerJogColorA: '#FFFFFF', //type 16 Colour string
//             PlayerJogColorB: '#FFFFFF',
//             Profile: {
//                 Application: {
//                     PlayerColor1: '#FFFFFF',
//                     PlayerColor1A: '#FFFFFF',
//                     PlayerColor1B: '#FFFFFF',
//                     PlayerColor2: '#FFFFFF',
//                     PlayerColor2A: '#FFFFFF',
//                     PlayerColor2B: '#FFFFFF',
//                     PlayerColor3: '#FFFFFF',
//                     PlayerColor3A: '#FFFFFF',
//                     PlayerColor3B: '#FFFFFF',
//                     PlayerColor4: '#FFFFFF',
//                     PlayerColor4A: '#FFFFFF',
//                     PlayerColor4B: '#FFFFFF',
//                     SyncMode: '',
//                 },
//             },
//         },
//     },
// }

// export const PlayerDeckStates = {
//     CurrentBPM: 120.00, //type 0 
//     ExternalMixerVolume: 1, //type 0
//     // ExternalScratchWheelTouch: false, //type 2 false?
//     // Pads: {
//     //     View: '', //type 4 ENUM? 'CUES'
//     // },
//     // Play: false,
//     PlayState: false,
//     //PlayStatePath: 'PlayStatePath', //NG
//     Speed: 1.0, //0.44444535
//     // SpeedNeutral: false,
//     // SpeedOffsetDown: false,
//     // SpeedOffsetUp: false,
//     // SpeedRange: '8', //enum
//     // SpeedState: 1.0, //type 0 signed -0.39999
//     SyncMode: 'Off', //enum: Off, Tempo, TempoSync
//     DeckIsMaster: false,
//     Track: {
//         ArtistName: '',
//         Bleep: false, //type 2 
//         CuePosition: 156.0, //type 14?
//         CurrentBPM: 120.0,
//         CurrentKeyIndex: 0, //type 10?
//         CurrentLoopInPosition: 156.0, //type 14
//         CurrentLoopOutPosition: 156.0, //type 14
//         CurrentLoopSizeInBeats: 0, // type 14
//         KeyLock: false,
//         LoopEnableState: false, //type 1
//         Loop: {
//             QuickLoop1: false, //type 2
//             QuickLoop2: false,
//             QuickLoop3: false,
//             QuickLoop4: false,
//             QuickLoop5: false,
//             QuickLoop6: false,
//             QuickLoop7: false,
//             QuickLoop8: false,
//         },
//         PlayPauseLEDState: false,
//         SampleRate: 44100, //type 14
//         SongAnalyzed: false,
//         SongLoaded: false,
//         SongName: '',
//         SoundSwitchGUID: '', //NG must be Analyzed?
//         TrackBytes: 1, //type 10
//         TrackData: false, //type 3???
//         TrackLength: 1, //type 10
//         TrackName: '', // type 8 can be /media/[SOURCE]/FILEPATH....
//         TrackNetworkPath: '',
//         TrackURI: '', //NG Only streaming?
//         TrackWasPlayed: false,
//     }
// }

// export const MixerStates = {
//     Mixer: {
//         CH1faderPosition: 1.27, //type 0
//         CH2faderPosition: 0.0,
//         CH3faderPosition: 0.0,
//         CH4faderPosition: 0.0,
//         CrossfaderPosition: 0.5, //type 0
//         //NumberOfChannels: 'NumberOfChannels', //NG 
//         // ChannelAssignment1: '', // type 8 format '{DEVICEID},1' or '{DEVICEID},2'
//         // ChannelAssignment2: '',
//         // ChannelAssignment3: '',
//         // ChannelAssignment4: '',
//     },
//     // Gui: {
//     //     ViewLayer: {
//     //         LayerB: 'LayerB',
//     //     },
//     //     Decks: {
//     //         Deck: {
//     //             ActiveDeck: 'ActiveDeck',
//     //         },
//     //     },
//     // },
// }

//const test = new MixerStates()



// export const exportObj = {
//     config: {

//     },
//     player: {
//         ...PlayerStates,
//     },
//     playerDeck: {
//         ...PlayerDeckStates
//     },
//     mixer: {
//         ...MixerStates,
//     }
// }





// console.log(JSON.stringify(exportObj));

// export const PlayerDeckTrackStates = {
//     ArtistName: 'ArtistName',
//     Bleep: 'Bleep',
//     CuePosition: 'CuePosition',
//     CurrentBPM: 'CurrentBPM',
//     CurrentKeyIndex: 'CurrentKeyIndex',
//     CurrentLoopInPosition: 'CurrentLoopInPosition',
//     CurrentLoopOutPosition: 'CurrentLoopOutPosition',
//     CurrentLoopSizeInBeats: 'CurrentLoopSizeInBeats',
//     KeyLock: 'KeyLock',
//     LoopEnableState: 'LoopEnableState',
//     LoopQuickLoop1: 'Loop/QuickLoop1',
//     LoopQuickLoop2: 'Loop/QuickLoop2',
//     LoopQuickLoop3: 'Loop/QuickLoop3',
//     LoopQuickLoop4: 'Loop/QuickLoop4',
//     LoopQuickLoop5: 'Loop/QuickLoop5',
//     LoopQuickLoop6: 'Loop/QuickLoop6',
//     LoopQuickLoop7: 'Loop/QuickLoop7',
//     LoopQuickLoop8: 'Loop/QuickLoop8',
//     PlayPauseLEDState: 'PlayPauseLEDState',
//     SampleRate: 'SampleRate',
//     SongAnalyzed: 'SongAnalyzed',
//     SongLoaded: 'SongLoaded',
//     SongName: 'SongName',
//     SoundSwitchGUID: 'SoundSwitchGuid',
//     TrackBytes: 'TrackBytes',
//     TrackData: 'TrackData',
//     TrackLength: 'TrackLength',
//     TrackName: 'TrackName',
//     TrackNetworkPath: 'TrackNetworkPath',
//     TrackURI: 'TrackUri',
//     TrackWasPlayed: 'TrackWasPlayed',
// }