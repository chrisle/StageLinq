"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const network_1 = require("../network");
const albumArt_1 = require("../albumArt");
const sleep_1 = require("../utils/sleep");
const services_1 = require("../services");
async function main() {
    // Start announcing ourselves.
    await (0, network_1.announce)();
    // Listen for new devices on the network.
    const listener = new network_1.DenonDeviceListener();
    // When a new device is found connect to it, ask it what services it offers,
    // and connect to a service.
    listener.onDeviceDiscovered(async (device) => {
        console.log(`New device discovered: "${device.source}" => ${device.address}:${device.port} ${JSON.stringify(device.software)}`);
        let retry = 0;
        while (retry < 3) {
            retry += 1;
            try {
                const networkDevice = new network_1.NetworkDevice(device);
                await networkDevice.connect();
                await (0, albumArt_1.maybeDownloadFiles)(networkDevice);
                const service = await networkDevice.connectToService(services_1.StateMap);
                if (service) {
                    console.log(`Connected successfully to ${device.source}`);
                    break;
                }
            }
            catch (e) {
                console.error(e);
            }
        }
    });
    while (true) {
        await (0, sleep_1.sleep)(250);
    }
}
exports.main = main;
//# sourceMappingURL=main.js.map