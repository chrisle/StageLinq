"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.X1850Prime = exports.States = void 0;
const network_1 = require("../network");
const network_2 = require("../network");
exports.States = [
    network_2.StageLinqValue.MixerCH1faderPosition,
    network_2.StageLinqValue.MixerCH2faderPosition,
    network_2.StageLinqValue.MixerCH3faderPosition,
    network_2.StageLinqValue.MixerCH4faderPosition,
    network_2.StageLinqValue.MixerCrossfaderPosition,
    network_2.StageLinqValue.MixerNumberOfChannels,
];
class X1850Prime extends network_1.NetworkDevice {
}
exports.X1850Prime = X1850Prime;
//# sourceMappingURL=X1850Prime.js.map