"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connect = void 0;
const net_1 = require("net");
const promise_socket_1 = require("promise-socket");
const types_1 = require("../types");
const LogEmitter_1 = require("../LogEmitter");
async function connect(p_ip, p_port) {
    const socket = new net_1.Socket();
    socket.setTimeout(types_1.CONNECT_TIMEOUT);
    const promiseSocket = new promise_socket_1.PromiseSocket(socket);
    await promiseSocket.connect(p_port, p_ip).catch((e) => {
        throw new Error(`Failed to connect to '${p_ip}:${p_port}': ${e}`);
    });
    LogEmitter_1.Logger.debug(`TCP connection to '${p_ip}:${p_port}' local port: ${promiseSocket.socket.localPort}`);
    return promiseSocket;
}
exports.connect = connect;
//# sourceMappingURL=tcp.js.map