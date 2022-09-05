import { Socket as TCPSocket } from 'net';
import { PromiseSocket } from 'promise-socket';
import { CONNECT_TIMEOUT } from '../network';
import { Logger } from '../LogEmitter';

export type Connection = PromiseSocket<TCPSocket>;

export async function connect(p_ip: string, p_port: number): Promise<Connection> {
	const socket = new TCPSocket();
	socket.setTimeout(CONNECT_TIMEOUT);
	const promiseSocket = new PromiseSocket(socket);
	await promiseSocket.connect(p_port, p_ip).catch((e) => {
		throw new Error(`Failed to connect to '${p_ip}:${p_port}': ${e}`);
	});
	Logger.debug(`TCP connection to '${p_ip}:${p_port}' local port: ${promiseSocket.socket.localPort}`);
	return promiseSocket;
}
