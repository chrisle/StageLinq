//import { hex } from '../utils/hex';
import { EventEmitter } from 'events';
import { Logger } from '../LogEmitter';
import { MessageId, MESSAGE_TIMEOUT, Tokens, ConnectionInfo } from '../types';
import { NetworkDevice } from '../network/NetworkDevice';
import { ServiceInitMessage, StageLinqDevices } from '../network';
import { ReadContext } from '../utils/ReadContext';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
//import * as tcp from '../utils/tcp';
import {Server, Socket, AddressInfo} from 'net';
import * as net from 'net';
import type { ServiceMessage, IpAddress } from '../types';

export declare interface ServiceDevice {
	on(event: 'listening', listener: (address: AddressInfo) => void): this;
	on(event: 'connected', listener: (socket: Socket) => void): this;
	//on(event: 'nowPlaying', listener: (status: PlayerStatus) => void): this;
	//on(event: 'connected', listener: (connectionInfo: ConnectionInfo) => void): this;
	//on(event: 'message', listener: (connectionInfo: ConnectionInfo, message: ServiceMessage<StateData>) => void): this;
	//on(event: 'ready', listener: () => void): this;
  }

export abstract class Service<T> extends EventEmitter {
	//private address: string;
	//private port: number;
	protected preparseData:boolean = true;
	public readonly name: string;
	public serverInfo: AddressInfo;
	public serverStatus: string;
	public connections: Map<string, Socket> = new Map();
	protected controller: NetworkDevice;
	//protected connection: tcp.Connection = null;
	protected connection: Socket = null;
	public server: Server = null;
	public serInitMsg: ServiceInitMessage;
	protected parent: InstanceType<typeof StageLinqDevices>;

	//constructor(p_address?: string, p_port?: number, p_controller?: NetworkDevice) {
	constructor(p_initMsg:ServiceInitMessage) {
		super();
		this.parent = p_initMsg.parent;
		this.serInitMsg = p_initMsg;
		
	}

	async createServer(serviceName: string): Promise<Server> {
		return await new Promise((resolve, reject) => {
			let queue: Buffer = null;
			const server = net.createServer((socket) => {
				console.log(`[${this.name}] connection from ${socket.remoteAddress}:${socket.remotePort}`)
				socket.on('error', (err) => {
					reject(err);
				});
				//socket.on('connect', () => {
					
				//});
				socket.on('data', async p_data => {
					
					
					
					
					//console.log(`Received data on ${serviceName}!!`)
					let buffer: Buffer = null;
					if (queue && queue.length > 0) {
						buffer = Buffer.concat([queue, p_data]);
					} else {
						buffer = p_data;
					}

					// FIXME: Clean up this arraybuffer confusion mess
					const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
					const ctx = new ReadContext(arrayBuffer, false);
					queue = null;
					const testBuf = ctx.readRemainingAsNewBuffer();
					ctx.rewind();
					const messageId = ctx.readUInt32();
					ctx.rewind();

					
					if (this.preparseData && messageId != 0) {
						try {
							while (ctx.isEOF() === false) {
								//console.log(`size remaining: `,ctx.sizeLeft())
								if (ctx.sizeLeft() < 4) {
									queue = ctx.readRemainingAsNewBuffer();
									break;
								}
								//console.log(`size remaining after if: `,ctx.sizeLeft())
								//const testBuf = ctx.readRemainingAsNewBuffer();
								const length = ctx.readUInt32();
								//console.log(length, testBuf);

								if ( length <= ctx.sizeLeft()) {
									const message = ctx.read(length);
									// Use slice to get an actual copy of the message instead of working on the shared underlying ArrayBuffer
									const data = message.buffer.slice(message.byteOffset, message.byteOffset + length);
									//Logger.info("RECV", length);
									//hex(message);
									const parsedData = this.parseData(new ReadContext(data, false),socket);
			
									// Forward parsed data to message handler
									this.messageHandler(parsedData);
									this.emit('message', parsedData);
								} else {
									ctx.seek(-4); // Rewind 4 bytes to include the length again
									queue = ctx.readRemainingAsNewBuffer();
									break;
								}
							}
						} catch (err) {
							// FIXME: Rethrow based on the severity?
							//console.log(testBuf);
							Logger.error(err);
						}
					} else {
						const parsedData = await this.parseData(ctx, socket)
						this.messageHandler(parsedData);
					}

					
					
					
					
					
					
					
					
				
				
				
				
				
				});
				
			}).listen(0, '0.0.0.0', () => {
				this.serverInfo = server.address() as net.AddressInfo;
				//console.log(address,port);
				console.log(`opened ${this.name} server on ${this.serverInfo.port}`);
				//this.subConnection[serviceName] = {
				//	socket: server,
				//	port: port
				//}
				resolve(server);
			});
		});
	}

	async listen(): Promise<AddressInfo> {
		const server = await this.createServer(this.name)
		this.server = server;
		return server.address() as net.AddressInfo;


		/*
		const server = new Server
		let queue: Buffer = null;
		server.listen();
		server.on('error', (err) =>{
			//throw new error err
			throw new Error(`Server Error ${err}`);
		});
		server.on('listen', () => {
			this.serverStatus = 'listening'
			this.serverInfo = server.address() as AddressInfo;
			this.emit('listening', this.serverInfo);
		});
		server.on('connection', (socket: Socket) => {
			//resolve(socket) 
			this.connection = socket;
			this.serverStatus = 'Connected';
			this.emit('connected', this.connection);
		});
		server.on('data', (p_data: Buffer) =>{
			const ctx = new ReadContext(p_data, false);
			this.parseData(ctx);
		});
		
		*/

	}
	

/*
	async connect(): Promise<void> {
		assert(!this.connection);
		this.connection = await tcp.connect(this.address, this.port);
		let queue: Buffer = null;

		this.connection.socket.on('data', (p_data: Buffer) => {
			let buffer: Buffer = null;
			if (queue && queue.length > 0) {
				buffer = Buffer.concat([queue, p_data]);
			} else {
				buffer = p_data;
			}

			// FIXME: Clean up this arraybuffer confusion mess
			const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
			const ctx = new ReadContext(arrayBuffer, false);
			queue = null;

			try {
				while (ctx.isEOF() === false) {
					if (ctx.sizeLeft() < 4) {
						queue = ctx.readRemainingAsNewBuffer();
						break;
					}

					const length = ctx.readUInt32();
					if (length <= ctx.sizeLeft()) {
						const message = ctx.read(length);
						// Use slice to get an actual copy of the message instead of working on the shared underlying ArrayBuffer
						const data = message.buffer.slice(message.byteOffset, message.byteOffset + length);
						// Logger.info("RECV", length);
						//hex(message);
						const parsedData = this.parseData(new ReadContext(data, false));

						// Forward parsed data to message handler
						this.messageHandler(parsedData);
						this.emit('message', parsedData);
					} else {
						ctx.seek(-4); // Rewind 4 bytes to include the length again
						queue = ctx.readRemainingAsNewBuffer();
						break;
					}
				}
			} catch (err) {
				// FIXME: Rethrow based on the severity?
				Logger.error(err);
			}
		});

		// FIXME: Is this required for all Services?
		const ctx = new WriteContext();
		ctx.writeUInt32(MessageId.ServicesAnnouncement);
		ctx.write(Tokens.SoundSwitch);
		ctx.writeNetworkStringUTF16(this.name);
		ctx.writeUInt16(this.connection.localPort); // FIXME: In the Go code this is the local TCP port, but 0 or any other 16 bit value seems to work fine as well
		await this.write(ctx);

		await this.init();

		Logger.debug(`Connected to service '${this.name}' at port ${this.port}`);
	}
*/
	disconnect() {
		assert(this.connection);
		try {
			this.connection.destroy();
		} catch (e) {
			Logger.error('Error disconnecting', e);
		} finally {
			this.connection = null;
		}
	}

	//closeServer() {

	//}

	async waitForMessage(p_messageId: number): Promise<T> {
		return await new Promise((resolve, reject) => {
			const listener = (p_message: ServiceMessage<T>) => {
				if (p_message.id === p_messageId) {
					this.removeListener('message', listener);
					resolve(p_message.message);
				}
			};
			this.addListener('message', listener);
			setTimeout(() => {
				reject(new Error(`Failed to receive message '${p_messageId}' on time`));
			}, MESSAGE_TIMEOUT);
		});
	}

	async write(p_ctx: WriteContext) {
		assert(p_ctx.isLittleEndian() === false);
		assert(this.connection);
		const buf = p_ctx.getBuffer();
		// Logger.info("SEND");
		//hex(buf);
		const written = await this.connection.write(buf);
		//assert(written === buf.byteLength);
		return written;
	}

	async writeWithLength(p_ctx: WriteContext) {
		assert(p_ctx.isLittleEndian() === false);
		assert(this.connection);
		const newCtx = new WriteContext({ size: p_ctx.tell() + 4, autoGrow: false });
		newCtx.writeUInt32(p_ctx.tell());
		newCtx.write(p_ctx.getBuffer());
		assert(newCtx.isEOF());
		return await this.write(newCtx);
	}

	public getIdFromIp(map:Map<string, ConnectionInfo>, val:string) {
		const thisEntry = [...map.values()].filter((item: ConnectionInfo) => item.addressPort === val);
		return thisEntry.keys.toString();
	  }


	// FIXME: Cannot use abstract because of async; is there another way to get this?
	protected async init() {
		assert.fail('Implement this');
	}

	//protected dataPreparser()

	protected abstract parseData(p_ctx: ReadContext, socket?: Socket): ServiceMessage<T>;

	protected abstract messageHandler(p_data: ServiceMessage<T>): void;
}
