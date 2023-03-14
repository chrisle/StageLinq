
export const PlayerStates = {
    Gui: {
        ViewLayer: {
            LayerB: 'LayerBB',
        },
        Decks: {
            Deck: {
                ActiveDeck: 'ActiveDeck',
            },
        },
    },
    Engine: {
        DeckCount: 2, //type 10
        Sync: {
            Network: {
                MasterStatus: false,
            },
        },
        Master: {
            MasterTempo: 120.0, //type 0
        },
    },
    Client: {
        Librarian: {
            DevicesController: {
                CurrentDevice: '', //type 8 can be URI net://[DEVICEID]/[SOURCENAME] ([LOCATION?]) or /media/[SOURCENAME]
                HasSDCardConnected: false,
                HasUsbDeviceConnected: false,
            },
        },
        Preferences: {
            LayerA: 'LayerA', //NG
            LayerB: true,
            Player: '1', //type 4 ENUM? 
            PlayerJogColorA: 'PlayerJogColorA', //type 16 Colour string
            PlayerJogColorB: 'PlayerJogColorB',
            Profile: {
                Application: {
                    PlayerColor1: 'PlayerColor1',
                    PlayerColor1A: 'PlayerColor1A',
                    PlayerColor1B: 'PlayerColor1B',
                    PlayerColor2: 'PlayerColor2',
                    PlayerColor2A: 'PlayerColor2A',
                    PlayerColor2B: 'PlayerColor2B',
                    PlayerColor3: 'PlayerColor3',
                    PlayerColor3A: 'PlayerColor3A',
                    PlayerColor3B: 'PlayerColor3B',
                    PlayerColor4: 'PlayerColor4',
                    PlayerColor4A: 'PlayerColor4A',
                    PlayerColor4B: 'PlayerColor4B',
                    SyncMode: 'Tempo', //type 4 ENUM
                },
            },
        },
    },   
}

export const PlayerDeckStates = {
    CurrentBPM: 120.00, //type 0 
    ExternalMixerVolume: 1, //type 0
    ExternalScratchWheelTouch: false, //type 2 false?
    Pads: {
        View: '', //type 4 ENUM? 'CUES'
    },
    Play: false,
    PlayState: false,
    PlayStatePath: 'PlayStatePath', //NG
    Speed: 1.0, //0.44444535
    SpeedNeutral: false,
    SpeedOffsetDown: false,
    SpeedOffsetUp: false,
    SpeedRange: '8', //enum
    SpeedState: 1.0, //type 0 signed -0.39999
    SyncMode: 'Off', //enum: Off, Tempo, TempoSync
    DeckIsMaster: false,
    Track: {
        ArtistName: '',
        Bleep: false, //type 2 
        CuePosition: 156.0, //type 14?
        CurrentBPM: 119.51, 
        CurrentKeyIndex: 0, //type 10?
        CurrentLoopInPosition: 156.0, //type 14
        CurrentLoopOutPosition: 156.0, //type 14
        CurrentLoopSizeInBeats: 0, // type 14
        KeyLock: true,
        LoopEnableState: false, //type 1
        Loop: {
            QuickLoop1: false, //type 2
            QuickLoop2: false,
            QuickLoop3: false,
            QuickLoop4: false,
            QuickLoop5: false,
            QuickLoop6: false,
            QuickLoop7: false,
            QuickLoop8: false,
        },
        PlayPauseLEDState: false,
        SampleRate: 44100, //type 14
        SongAnalyzed: false,
        SongLoaded: false,
        SongName: '', 
        SoundSwitchGUID: 'SoundSwitchGuid', //NG must be Analyzed?
        TrackBytes: 15323626, //type 10
        TrackData: false, //type 3???
        TrackLength: 16445952, //type 10
        TrackName: '', // type 8 can be /media/[SOURCE]/FILEPATH....
        TrackNetworkPath: '',
        TrackURI: 'TrackUri', //NG Only streaming?
        TrackWasPlayed: false,
    }   
}

export const MixerStates = {
    Mixer: {
        CH1faderPosition: 1.27, //type 0
        CH2faderPosition: 0.0,
        CH3faderPosition: 0.0,
        CH4faderPosition: 0.0,
        CrossfaderPosition: 0.5, //type 0
        NumberOfChannels: 'NumberOfChannels', //NG 
        ChannelAssignment1: '', // type 8 format '{DEVICEID},1' or '{DEVICEID},2'
        ChannelAssignment2: '',
        ChannelAssignment3: '',
        ChannelAssignment4: '',
    },
    Gui: {
        ViewLayer: {
            LayerB: 'LayerB',
        },
        Decks: {
            Deck: {
                ActiveDeck: 'ActiveDeck',
            },
        },
    },
}


// export const PlayerDeckTrackStates = {
//    ArtistName: 'ArtistName',
//    Bleep: 'Bleep',
//    CuePosition: 'CuePosition',
//    CurrentBPM: 'CurrentBPM',
//    CurrentKeyIndex: 'CurrentKeyIndex',
//    CurrentLoopInPosition: 'CurrentLoopInPosition',
//    CurrentLoopOutPosition: 'CurrentLoopOutPosition',
//    CurrentLoopSizeInBeats: 'CurrentLoopSizeInBeats',
//    KeyLock: 'KeyLock',
//    LoopEnableState: 'LoopEnableState',
//    LoopQuickLoop1: 'Loop/QuickLoop1',
//    LoopQuickLoop2: 'Loop/QuickLoop2',
//    LoopQuickLoop3: 'Loop/QuickLoop3',
//    LoopQuickLoop4: 'Loop/QuickLoop4',
//    LoopQuickLoop5: 'Loop/QuickLoop5',
//    LoopQuickLoop6: 'Loop/QuickLoop6',
//    LoopQuickLoop7: 'Loop/QuickLoop7',
//    LoopQuickLoop8: 'Loop/QuickLoop8',
//    PlayPauseLEDState: 'PlayPauseLEDState',
//    SampleRate: 'SampleRate',
//    SongAnalyzed: 'SongAnalyzed',
//    SongLoaded: 'SongLoaded',
//    SongName: 'SongName',
//    SoundSwitchGUID: 'SoundSwitchGuid',
//    TrackBytes: 'TrackBytes',
//    TrackData: 'TrackData',
//    TrackLength: 'TrackLength',
//    TrackName: 'TrackName',
//    TrackNetworkPath: 'TrackNetworkPath',
//    TrackURI: 'TrackUri',
//    TrackWasPlayed: 'TrackWasPlayed',
// }