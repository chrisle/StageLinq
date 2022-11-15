"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActingAsDevice = exports.Tokens = void 0;
exports.Tokens = {
    SoundSwitch: new Uint8Array([82, 253, 252, 7, 33, 130, 101, 79, 22, 63, 95, 15, 154, 98, 29, 114]),
    Sc6000_1: new Uint8Array([130, 139, 235, 2, 218, 31, 78, 104, 166, 175, 176, 177, 103, 234, 240, 162]),
    Sc6000_2: new Uint8Array([38, 210, 56, 103, 28, 214, 78, 63, 128, 161, 17, 130, 106, 196, 17, 32]),
    Resolume: new Uint8Array([136, 250, 32, 153, 172, 122, 79, 63, 188, 22, 169, 149, 219, 218, 42, 66])
};
exports.ActingAsDevice = {
    NowPlaying: {
        name: 'nowplaying',
        version: '2.2.0',
        source: 'np2',
        token: exports.Tokens.SoundSwitch
    },
    Sc6000_1: {
        name: 'sc6000',
        version: '2.3.1',
        source: 'JP13',
        token: exports.Tokens.Sc6000_1
    },
    Sc6000_2: {
        name: 'sc6000',
        version: '2.3.1',
        source: 'JP13',
        token: exports.Tokens.Sc6000_2
    },
    Resolume: {
        name: 'resolume',
        version: '10.0.0',
        source: 'res',
        token: exports.Tokens.Resolume
    }
};
//# sourceMappingURL=tokens.js.map