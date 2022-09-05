"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connect = void 0;
const net_1 = require("net");
const promise_socket_1 = require("promise-socket");
const network_1 = require("../network");
const Logger_1 = require("./Logger");
async function connect(p_ip, p_port) {
    const socket = new net_1.Socket();
    socket.setTimeout(network_1.CONNECT_TIMEOUT);
    const promiseSocket = new promise_socket_1.PromiseSocket(socket);
    await promiseSocket.connect(p_port, p_ip).catch((e) => {
        throw new Error(`Failed to connect to '${p_ip}:${p_port}': ${e}`);
    });
    Logger_1.Logger.log(`TCP connection to '${p_ip}:${p_port}' local port: ${promiseSocket.socket.localPort}`);
    return promiseSocket;
}
exports.connect = connect;
//# sourceMappingURL=tcp.js.map