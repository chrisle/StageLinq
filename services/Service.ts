import { EventEmitter } from 'events';
import { Logger } from '../LogEmitter';
import { MessageId, MESSAGE_TIMEOUT, Tokens, ConnectionInfo, deviceIdFromBuff } from '../types';
import { ServiceInitMessage, StageLinqDevices } from '../network';
import { ReadContext } from '../utils/ReadContext';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
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

export declare type ServiceData = {
	socket?: Socket;
	deviceId?: string;
	service?: InstanceType<typeof Service>;
}

export abstract class Service<T> extends EventEmitter {
	//private address: string;
	//private port: number;
	protected preparseData:boolean = true;
	public readonly name: string = "Service";
	public serverInfo: AddressInfo;
	public serverStatus: string;
	public connections: Map<string, Socket> = new Map();
	public deviceIds: Map<string, string> = new Map();
	public deviceIps: Map<string, string> = new Map();
	public serviceList: Map<string, ServiceData> = new Map();
	//protected controller: NetworkDevice;
	//protected connection: tcp.Connection = null;
	protected connection: Socket = null;
	public server: Server = null;
	public serInitMsg: ServiceInitMessage;
	protected parent: InstanceType<typeof StageLinqDevices>;
	private msgId: number = 0;

	//constructor(p_address?: string, p_port?: number, p_controller?: NetworkDevice) {
	constructor(p_initMsg:ServiceInitMessage) {
		super();
		this.parent = p_initMsg.parent;
		this.serInitMsg = p_initMsg;
	}
	protected isSubMsg(ctx: ReadContext): boolean {
		//return new Promise((resolve, reject) => {
			//const ttx = ctx.readRemainingAsNewBuffer();
			//ctx.rewind();
			
			
			const messageId = ctx.readUInt32()
				//console.log(messageId)
				
			const token = ctx.read(16);

			if (messageId === 0 && this.parent.peers.has(deviceIdFromBuff(token))) {
				return true
			} else {
				return false
			}

			/*
			while (ctx.isEOF() === false) {
				//console.log(ctx.sizeLeft());
				if (ctx.sizeLeft() <= 20) {break;}
				const messageId = ctx.readUInt32()
				//console.log(messageId)
				if (messageId !== 0) {break;}
				const token = ctx.read(16);
				//console.log(Buffer.from(token).toString('hex'))
				if (ctx.sizeLeft() < 4) {break;}
				const length = ctx.readUInt32();
				//console.log(length, ctx.sizeLeft());
				if (length > ctx.sizeLeft()) {break;}
				ctx.seek(-4);

				const service = ctx.readNetworkStringUTF16()
				//console.log(service);
				//if (ctx.sizeLeft() <= 4) {break;}
				//ctx.rewind();
				return true
				//resolve(new ReadContext(ttx, false));
			} 
			//reject(new ReadContext(ttx, false))
		//});
		//ctx.rewind();
		return false
		*/
		//const messageId = ctx.readUInt32;

	}

	async createServer(serviceName: string): Promise<Server> {
		return await new Promise((resolve, reject) => {
			let queue: Buffer = null;
			const server = net.createServer((socket) => {
				//const deviceId = this.deviceIps.set([socket.rem])
				Logger.debug(`[${this.name}] connection from ${socket.remoteAddress}:${socket.remotePort}`)

				socket.on('error', (err) => {
					reject(err);
				});
				
				socket.on('data', p_data => {
					//let messages:ReadContext[] = [];
					const thisMsgId = this.msgId;
					this.msgId++
					const testArrayBuffer = p_data.buffer.slice(p_data.byteOffset, p_data.byteOffset + p_data.byteLength);
					const ttx = new ReadContext(testArrayBuffer,false);
					this.testPoint(ttx, this.getDeviceIdFromSocket(socket), this.msgId, "p_data", true );  
					
					const isSub = this.isSubMsg(ttx);

					let buffer: Buffer = null;
					if (queue && queue.length > 0) {
						buffer = Buffer.concat([queue, p_data]);
					} else {
						buffer = p_data;
					}

					// FIXME: Clean up this arraybuffer confusion mess
					const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
					let ctx = new ReadContext(arrayBuffer, false);
					this.testPoint(ctx, this.getDeviceIdFromSocket(socket), this.msgId, "buffQueue", true );  
					queue = null;
					//ctx = await this.testPoint(ctx, this.getDeviceIdFromSocket(socket), this.msgId, "data", true );  
					/*
					let isSub = false;
					while (ctx.isEOF() === false) {
						if (ctx.sizeLeft() <= 20) break;
						const messageId = ctx.readUInt32()
						if (messageId !== 0) break;
						const token = ctx.read(16);
						if (ctx.sizeLeft() < 4) break;
						const length = ctx.readUInt32();
						if (length <= ctx.sizeLeft()) break;
						ctx.seek(-4);
						const service = ctx.readNetworkStringUTF16()
						if (ctx.sizeLeft() !== 4) break;
						isSub = true;
						const port = ctx.readUInt16();
					} 
					
					ctx.rewind();
*/
					
				
					//const messageId = ctx.readUInt32();
					//ctx.rewind();
					//console.warn(socket.localPort, " ", this.parent.directoryPort);
					if (!this.preparseData || socket.localPort === this.parent.directoryPort || isSub) {
						try {
							//ctx = this.testPoint(ctx, this.getDeviceIdFromSocket(socket), this.msgId, "no-preparse", true );  
							const parsedData = this.parseData(ctx, socket,thisMsgId, isSub);
							this.emit('message', parsedData);
							this.messageHandler(parsedData);
						} catch (err) {
							Logger.error(this.msgId, err);
						}
					} else {
						try {
							//ctx = this.testPoint(ctx, this.getDeviceIdFromSocket(socket), this.msgId, "no-preparse", true );  
							while (ctx.isEOF() === false) {
								if (ctx.sizeLeft() < 4) {
									queue = ctx.readRemainingAsNewBuffer();
									break;
								}

								const length = ctx.readUInt32()

								if ( length <= ctx.sizeLeft()) {
									const message = ctx.read(length);
									// Use slice to get an actual copy of the message instead of working on the shared underlying ArrayBuffer
									const data = message.buffer.slice(message.byteOffset, message.byteOffset + length);
									//let data = new ReadContext(message.buffer.slice(message.byteOffset, message.byteOffset + length), false)
									//data = await this.testPoint(data, this.getDeviceIdFromSocket(socket), this.msgId, "preparse", true );  
									
									this.msgId++
									const parsedData = this.parseData(new ReadContext(data,false), socket, thisMsgId);
									this.testPoint(new ReadContext(data,false), this.getDeviceIdFromSocket(socket), this.msgId, "while", true );  
									//messages.push(new ReadContext(data, false))
									// Forward parsed data to message handler
									
									this.messageHandler(parsedData);
									this.emit('message', parsedData);
								} else {
									ctx.seek(-4); // Rewind 4 bytes to include the length again
									this.testPoint(ctx, this.getDeviceIdFromSocket(socket), this.msgId, "toqueue", true );
									queue = ctx.readRemainingAsNewBuffer();
									break;
								}
							}
							//for (const ctx of messages) {
							//	const stringMsg = ctx.getString(ctx.sizeLeft())
							//	console.log(stringMsg);
							//}
						} catch (err) {
							Logger.error(this.msgId, err);
						}
					}

				});
			}).listen(0, '0.0.0.0', () => {
				this.serverInfo = server.address() as net.AddressInfo;
				console.log(`opened ${this.name} server on ${this.serverInfo.port}`);
				resolve(server);
			});
		});
	}

	async listen(): Promise<AddressInfo> {
		const server = await this.createServer(this.name)
		this.server = server;
		return server.address() as net.AddressInfo;
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
			//this.connection = null;
		}
	}

	getDeviceIdFromSocket(socket: Socket):string {
		const ipPort = [socket.remoteAddress, socket.remotePort].join(":");
		const deviceId = this.deviceIps.get(ipPort);
		return deviceId
	}

	async waitForMessage(p_messageId: number): Promise<T> {
		return await new Promise((resolve, reject) => {
			const listener = (p_message: ServiceMessage<T>) => {
				if (p_message.id === p_messageId) {
					this.removeListener('message', listener);
					//resolve(p_message.message);
					resolve(p_message.message);
				}
			};
			this.addListener('message', listener);
			setTimeout(() => {
				reject(new Error(`Failed to receive message '${p_messageId}' on time`));
			}, MESSAGE_TIMEOUT);
		});
	}

	async write(p_ctx: WriteContext, socket: Socket) {
		assert(p_ctx.isLittleEndian() === false);
		const buf = p_ctx.getBuffer();
		const written = await socket.write(buf);
		return written;
	}

	async writeWithLength(p_ctx: WriteContext, socket: Socket) {
		assert(p_ctx.isLittleEndian() === false);
		const newCtx = new WriteContext({ size: p_ctx.tell() + 4, autoGrow: false });
		newCtx.writeUInt32(p_ctx.tell());
		newCtx.write(p_ctx.getBuffer());
		assert(newCtx.isEOF());
		return await this.write(newCtx, socket);
	}

	public getIdFromIp(map:Map<string, ConnectionInfo>, val:string) {
		const thisEntry = [...map.values()].filter((item: ConnectionInfo) => item.addressPort === val);
		return thisEntry.keys.toString();
	  }

	protected testPoint(_ctx: ReadContext, deviceId: string, msgId: number, name: string, silent?:boolean, isSvc?: boolean) {
		const ctx = _ctx.readRemainingAsNewCtx();
		const length = ctx.sizeLeft();
		let buff = ctx.readRemainingAsNewBuffer().toString('hex');
		ctx.seek(0- length);
		if (buff.length > 1000) {
			buff = buff.substring(0,40);
			buff += "...";
		} 
		if (silent) {
			Logger.silent(`[${msgId}] [svc:${isSvc}] [${this.name}] (${name}) ${deviceId} ${length} ${buff}`);
		} else {
			Logger.debug(`[${msgId}] [svc:${isSvc}] [${this.name}] (${name}) ${deviceId} ${length} ${buff}`);
		}
	}


	// FIXME: Cannot use abstract because of async; is there another way to get this?
	protected async init() {
		assert.fail('Implement this');
	}

	protected abstract parseData(p_ctx: ReadContext, socket?: Socket, msgId?: number,isSub?:boolean): ServiceMessage<T>;

	protected abstract messageHandler(p_data: ServiceMessage<T>): void;
}
