import { EventEmitter } from 'events';
import { Logger } from '../LogEmitter';
import { MessageId, MESSAGE_TIMEOUT, Tokens, ConnectionInfo, DeviceId, deviceIdFromBuff } from '../types';
import { ServiceInitMessage, StageLinqDevices } from '../network';
import { ReadContext } from '../utils/ReadContext';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import {Server, Socket, AddressInfo} from 'net';
import * as net from 'net';
import type { ServiceMessage, IpAddress, IpAddressPort } from '../types';

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
	deviceId?: DeviceId;
	service?: InstanceType<typeof Service>;
}

//type PeerData = {
	
//}
/*
interface MsgId {
	(val: number): string;
	//loopId: number;
	//getString(): string;
	increment(): void;
	reset(): void;
}

function getMsgId(): MsgId {
	let msgId = function (start: number) {} as MsgId;
	//counter.interval = 123;
	msgId.reset = function () {};
	msgId.increment = function () {};
	return msgId;
  }
  */

interface Counter {
	(start: number): string;
	interval: number;
	reset(): void;
  }
   
  function getCounter(): Counter {
	let counter = function (start: number) {} as Counter;
	counter.interval = 1;
	counter.reset = function () {};
	return counter;
  }
   
  class MsgId {
	public id: number = 0;
	public loopId: number = 1;

	constructor(p_id?: number) {
		this.id = p_id;
	}

	incrementId() {this.id++};
	incrementLoopId() {this.loopId++};
	reset() {this.loopId = 1}
	toString(): string {
		return `[${this.id}]:[${this.loopId}]`
	}
  }
 

type ServiceBuffers = {
	[key: string]: Buffer;
}

export abstract class Service<T> extends EventEmitter {
	//private address: string;
	public port: number;
	protected preparseData:boolean = true;
	public readonly name: string = "Service";
	public serverInfo: AddressInfo;
	public peerDeviceIds: Record<IpAddressPort, DeviceId> = {}
	//public peerDeviceIds: Record<InstanceType, DeviceId> = {}
	public serverStatus: boolean = false;
	public connections: Map<string, Socket> = new Map();
	public deviceIds: Map<string, string> = new Map();
	public deviceIps: Map<string, string> = new Map();
	public serviceList: Map<string, ServiceData> = new Map();
	public hasSubbed: boolean = false;
	//protected serviceBuffers: Map<string, Buffer> = new Map();
	protected serviceBuffers: ServiceBuffers = {};
	//protected controller: NetworkDevice;
	//protected connection: tcp.Connection = null;
	protected connection: Socket = null;
	public server: Server = null;
	public serInitMsg: ServiceInitMessage;
	protected parent: InstanceType<typeof StageLinqDevices>;
	private msgId: number = 0;

	//constructor(p_address?: string, p_port?: number, p_controller?: NetworkDevice) {
	constructor(p_parent:InstanceType<typeof StageLinqDevices>) {
		super();
		this.parent = p_parent;
		//this.serInitMsg = p_initMsg;
	}
	protected async isSubMsg(_ctx: ReadContext): Promise<number> {
		
			const ctx = _ctx.readRemainingAsNewCtx();
			const messageId = ctx.readUInt32()
				
			const token = ctx.read(16);
			const deviceId = deviceIdFromBuff(token);
			let netStringLength = 0
			if (_ctx.sizeLeft() >= 8) {
				netStringLength = ctx.readUInt32();
				netStringLength += 4;
			}
			//this.testPoint(ctx, deviceId, this.msgId, "isSub", true );
			const hasPeer = await this.parent.peers.has(deviceId)
			if (messageId === 0 && hasPeer) {
				
				return (20 + netStringLength)
			} else {
				return 0
			}
	}

	private async serverMessageParser(p_data: Buffer, socket: Socket) {
		
	}

	private async serviceMessage(p_data:Buffer, ipAddressPort: IpAddressPort , deviceId:DeviceId) {

	}

	async createServer(serviceName: string): Promise<Server> {
		return await new Promise((resolve, reject) => {
			//let serviceBuffers:ServiceBuffers = {}
			//let queue: Buffer = null;
			const server = net.createServer((socket) => {
				//const deviceId = this.deviceIps.set([socket.rem])
				Logger.debug(`[${this.name}] connection from ${socket.remoteAddress}:${socket.remotePort}`)
				
				//Handle identification of incoming socket. 
				const addressInfo:AddressInfo = {
					address: socket.remoteAddress,
					port: socket.remotePort,
					family: socket.remoteFamily,
				}
				const ipAddressPort = [socket.remoteAddress,socket.remotePort].join(":");

				//Initialize new buffer for this connection
				let queue: Buffer = null;
				this.serviceBuffers[ipAddressPort] = queue;
				//this.serviceBuffers.set(ipAddressPort,null);
				
				let deviceId = this.peerDeviceIds[ipAddressPort];

				
				//let deviceId = (this.deviceIps.has(ipAddressPort)) ? this.deviceIps.get(ipAddressPort) : ipAddressPort;
				
				
				
				socket.on('error', (err) => {
					reject(err);
				});
				
				socket.on('data', async p_data => {
					//let messages:ReadContext[] = [];
					this.msgId++
					const msgId = new MsgId(this.msgId);
					

					//append queue to current data
					let buffer: Buffer = null;
					if (this.serviceBuffers[ipAddressPort] && this.serviceBuffers[ipAddressPort].length > 0) {
						buffer = Buffer.concat([this.serviceBuffers[ipAddressPort], p_data]);
						//Logger.info(`[${msgId.toString()}] serviceBuffer ${ipAddressPort} ${this.serviceBuffers[ipAddressPort].length} ${this.serviceBuffers[ipAddressPort].toString('hex')}`);
					} else {
						buffer = p_data;
					}
					this.serviceBuffers[ipAddressPort] = null

					// FIXME: Clean up this arraybuffer confusion mess
					const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
					let ctx = new ReadContext(arrayBuffer, false);

					//If directory service, send unparsed data immediately, empty buffer
					if (this.name === "Directory") {
						const parsedData = this.parseData(new ReadContext(ctx.readRemainingAsNewArrayBuffer(),false), socket, msgId.id);
						//this.testPoint(new ReadContext(testArrayBuffer,false), deviceId, thisMsgId, "while", true );  
						this.messageHandler(parsedData);
						this.emit('message', parsedData);
					}
					//check if device has announced itself to this service yet
					if (!deviceId && ctx.sizeLeft() >= 20) {
						this.testPoint(ctx, "noID", msgId, "!deviceID", true);  
						const messageId = ctx.readUInt32()
						deviceId = new DeviceId(ctx.read(16));
						
						//peak at network string length then rewind
						const stringLength = ctx.readUInt32();
						
						//Logger.debug(`string length: ${stringLength}  ctx sizeLeft: ${ctx.sizeLeft()}`)
						ctx.seek(-4);
						(assert (stringLength <= ctx.sizeLeft()));
						
						const serviceName = ctx.readNetworkStringUTF16();
						
						(assert (ctx.sizeLeft() >= 2));
						const port = ctx.readUInt16();
						(assert(port === addressInfo.port))
						this.peerDeviceIds[ipAddressPort] = deviceId;
						//this.parseServiceData
						
						//const wtx = ne
						Logger.debug(`${MessageId[messageId]} to ${serviceName} from ${deviceId.toString()}`)
						const parsedData = this.parseServiceData(messageId, deviceId, serviceName, socket, msgId.id);
						//this.testPoint(new ReadContext(testArrayBuffer,false), deviceId, thisMsgId, "while", true );  
						this.messageHandler(parsedData);
						this.emit('message', parsedData);
					} 
					
					
					/*
					let hexString = p_data.toString('hex');
					const hexStringLength = hexString.length;
					if (hexString.length > 195) {
						hexString = [hexString.substring(0,20), hexString.substring(hexString.length-20,hexString.length)].join('...');
					}
					if (this.name === "FileTransfer") {
						Logger.debug(this.name, thisMsgId, p_data.length, hexStringLength, hexString);
					}
					*/

					//let queue: Buffer = this.serviceBuffers.get(ipAddressPort);
					
					//let serviceBuffers:ServiceBuffers = {}
					

					//if (p_data.buffer) {

					//}
					/*
					const testArrayBuffer = p_data.buffer.slice(p_data.byteOffset, p_data.byteOffset + p_data.byteLength);
					const ttx = new ReadContext(testArrayBuffer,false);
					//this.testPoint(ttx, deviceId, thisMsgId, "p_data", true );  
					//let queue
					let isSub = 0;
					if (this.name === "Directory")  {
						isSub = 99
					} else {
						isSub = await this.isSubMsg(ttx);
					}
					

					if (!!isSub) {
						Logger.debug(this.name, thisMsgId,' sub msg ', hexString);
						this.msgId++
						const parsedData = this.parseData(new ReadContext(testArrayBuffer,false), socket, thisMsgId,true);
						//this.testPoint(new ReadContext(testArrayBuffer,false), deviceId, thisMsgId, "while", true );  
						this.messageHandler(parsedData);
						this.emit('message', parsedData);
					}

					if (this.deviceIps.has(ipAddressPort) && deviceId === ipAddressPort) {
						deviceId = this.deviceIps.get(ipAddressPort);
					}

					
					const isSubSeek = (isSub > ctx.sizeLeft()) ?  ctx.sizeLeft() : isSub
					ctx.seek(isSubSeek);
					this.testPoint(ctx, deviceId, thisMsgId, "buffQueue", true );  
					queue = null;

					*/
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
					
					/*
					if (!this.preparseData || socket.localPort === this.parent.directoryPort || !!isSub) {
						try {
							this.testPoint(ctx, deviceId, thisMsgId, "toparse", true );  
							const parsedData = this.parseData(ctx, socket,thisMsgId);
							this.emit('message', parsedData);
							this.messageHandler(parsedData);
						} catch (err) {
							Logger.error(this.name, thisMsgId, deviceId, err);
						}
					} else {
						*/
						//if (this.name !== 'Directory') {
							//Logger.debug(`[${this.name}] isEof: ${ctx.isEOF()}  ctx sizeLeft: ${ctx.sizeLeft()}`);
						//}
						
						try {
							//ctx = this.testPoint(ctx, this.getDeviceIdFromSocket(socket), this.msgId, "no-preparse", true );  
							//let loopId = 1
							while (ctx.isEOF() === false) {
								
								if (ctx.sizeLeft() < 4) {
									this.serviceBuffers[ipAddressPort] = ctx.readRemainingAsNewBuffer();
									break;
								}

								const length = ctx.readUInt32()

								//if ( length > 0 && length <= ctx.sizeLeft()) {

								if ( length <= ctx.sizeLeft()) {
									if (length === 0) {
										Logger.warn('wtf!');
									}
									const message = ctx.read(length);
									// Use slice to get an actual copy of the message instead of working on the shared underlying ArrayBuffer
									const data = message.buffer.slice(message.byteOffset, message.byteOffset + length);
									
									//let data = new ReadContext(message.buffer.slice(message.byteOffset, message.byteOffset + length), false)
									//data = await this.testPoint(data, this.getDeviceIdFromSocket(socket), this.msgId, "preparse", true );  
									
									this.msgId++
									const parsedData = this.parseData(new ReadContext(data,false), socket, msgId.loopId);
									this.testPoint(new ReadContext(data,false), deviceId.toString(), msgId, "while", true );  
									//messages.push(new ReadContext(data, false))
									// Forward parsed data to message handler
									
									this.messageHandler(parsedData);
									this.emit('message', parsedData);
								} else {
									ctx.seek(-4); // Rewind 4 bytes to include the length again
									this.testPoint(ctx, deviceId.toString(), msgId, "toqueue", true );
									this.serviceBuffers[ipAddressPort] = ctx.readRemainingAsNewBuffer();
									if (queue && queue.length < 50) {
										//Logger.debug(this.name, msgId.toString(), queue.toString('hex'));
									}
									break;
								}
								msgId.incrementLoopId();
							}
							//for (const ctx of messages) {
							//	const stringMsg = ctx.getString(ctx.sizeLeft())
							//	console.log(stringMsg);
							//}
						} catch (err) {
							Logger.error(this.name, msgId.toString(), deviceId.toString(), err);
						}
					//}

				});
			}).listen(0, '0.0.0.0', () => {
				this.serverStatus = true;
				this.serverInfo = server.address() as net.AddressInfo;
				console.log(`opened ${this.name} server on ${this.serverInfo.port}`);
				resolve(server);
			});
		});
	}

	async listen(): Promise<AddressInfo> {
		const server = await this.createServer(this.name)
		this.server = server;
		
		const serverAddress = server.address() as net.AddressInfo;
		this.port = serverAddress.port;
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
			//Logger.info(`listening for msg ${p_messageId}`);
			const listener = (p_message: ServiceMessage<T>) => {
				//Logger.info(`heard ${p_message.message}`);
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

	protected testPoint(_ctx: ReadContext, deviceId: string, msg: MsgId, name: string, silent?:boolean) {
		const ctx = _ctx.readRemainingAsNewCtx();
		const length = ctx.sizeLeft();
		let buff = ""
		if (!ctx.isEOF()) {
			buff = ctx.readRemainingAsNewBuffer().toString('hex');
		}
		
		ctx.seek(0- length);
		if (buff.length > 1000) {
			buff = buff.substring(0,40);
			buff += "...";
		} 
		if (silent) {
			Logger.silent(`[${msg.toString()}] [${this.name}] ${deviceId} (${name}) ${length} ${buff}`);
		} else {
			Logger.debug(`[${msg.toString()}] [${this.name}] ${deviceId} (${name}) ${length} ${buff}`);
		}
	}


	// FIXME: Cannot use abstract because of async; is there another way to get this?
	protected async init() {
		assert.fail('Implement this');
	}

	//protected abstract parseServiceData(p_ctx: ReadContext, socket?: Socket, msgId?: number,isSub?:boolean): ServiceMessage<T>;
	protected abstract parseServiceData(messageId:number, deviceId: DeviceId, serviceName: string, socket: Socket, msgId?: number,isSub?:boolean): ServiceMessage<T>;

	protected abstract parseData(p_ctx: ReadContext, socket?: Socket, msgId?: number,isSub?:boolean): ServiceMessage<T>;

	protected abstract messageHandler(p_data: ServiceMessage<T>): void;
}
