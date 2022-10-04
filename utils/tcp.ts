import { Socket as TCPSocket} from 'net';
import * as net from 'net';
import { PromiseSocket } from 'promise-socket';
import { CONNECT_TIMEOUT } from '../types';
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


	export async function createServer(p_name: string): Promise<TCPSocket> {
		return await new Promise((resolve, reject) => {
			const server = new net.Server;
			server.listen();
			server.on('error', err =>{
				reject(err)
				//throw new Error(`Server Error ${err}`);
			})
			server.on('connection', socket =>{
				resolve(socket) 
			})
		});
	}

/*
	export async function createServer(p_name: string): Promise<Connection> {
		return await new Promise((resolve, reject) => {
			const server = new TCPServer();
			server.((socket) => {
				socket.on('error', (err) => {
					reject(err);
				});
				socket.on('data', async data => {
					//console.log(`Received data on ${serviceName}!!`)
					const ctx = new ReadContext(data.buffer, false);
					const id = ctx.readUInt32();
					//ctx.rewind();
					const buff = ctx.readRemaining();

					console.log(serviceName, MessageId[id], buff)
					//this.newMessageHandler(data, serviceName);
				});
				
			}).listen(0, '0.0.0.0', () => {
				const { address, port } = server.address() as net.AddressInfo;
				
				this.subConnection[serviceName] = {
					socket: server,
					port: port
				}
				resolve(server);
			});
		});
	}
*/