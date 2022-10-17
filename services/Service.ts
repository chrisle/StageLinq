import { EventEmitter } from 'events';
import { Logger } from '../LogEmitter';
import { MessageId, MESSAGE_TIMEOUT, ConnectionInfo, DeviceId } from '../types';
import { ReadContext } from '../utils/ReadContext';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import {Server, Socket, AddressInfo} from 'net';
import * as net from 'net';
import type { ServiceMessage, IpAddressPort } from '../types';
import { StageLinq } from '../StageLinq';

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


//Just a handy debugging feature. I'll expand on this later.
class MsgId {
	public id: number = 0;
	public loopId: number = 1;

	constructor(p_id?: number) {
		this.id = p_id;
	}

	incrementId() {this.id++};
	incrementLoopId() {this.loopId++};
	reset() {this.loopId = 1}
	toString(): string { return `[${this.id}]:[${this.loopId}]`	}
}

type PeerBuffers = {
	[key: IpAddressPort]: Buffer;
}

export abstract class Service<T> extends EventEmitter {
	//public port: number;
	
	public readonly name: string = "Service";
	protected isBufferedService: boolean = true;
	protected parent: InstanceType<typeof StageLinq>;
	
	public server: Server = null;
	public serverInfo: AddressInfo;
	public serverStatus: boolean = false;
	
	protected peerDeviceIds: Record<IpAddressPort, DeviceId> = {}
	public peerSockets: Map<DeviceId, Socket> = new Map();
	public _peerSockets: Record<string, Socket> = {};
	protected peerBuffers: PeerBuffers = {};
	protected timeout: NodeJS.Timer;
	protected expectedDeviceId: DeviceId = null;
	
	private msgId: number = 0; //only used fro debugging

	constructor(p_parent:InstanceType<typeof StageLinq>, deviceId?: DeviceId) {
		super();
		this.parent = p_parent;
		this.expectedDeviceId = deviceId || null;
	}
	
	async createServer(): Promise<Server> {
		return await new Promise((resolve, reject) => {
			
			const server = net.createServer((socket) => {
				
				//Handle identification of incoming socket. 
				const addressInfo:AddressInfo = {
					address: socket.remoteAddress,
					port: socket.remotePort,
					family: socket.remoteFamily,
				}
				const ipAddressPort = [addressInfo.address, addressInfo.port].join(":");

				Logger.debug(`[${this.name}] connection from ${socket.remoteAddress}:${socket.remotePort}`)

				clearTimeout(this.timeout);
				
				//Initialize fresh buffer queue for this connection			
				this.peerBuffers[ipAddressPort] = null;
				
				//get device id from list of peers. will check if undefined later.
				let deviceId = this.peerDeviceIds[ipAddressPort];

				socket.on('error', (err) => {
					reject(err);
				});
				
				socket.on('data', async p_data => {
					
					//Only used for debugging. 
					this.msgId++
					const msgId = new MsgId(this.msgId);

					//append queue to current data
					let buffer: Buffer = null;
					if (this.peerBuffers[ipAddressPort] && this.peerBuffers[ipAddressPort].length > 0) {
						buffer = Buffer.concat([this.peerBuffers[ipAddressPort], p_data]);
					} else {
						buffer = p_data;
					}
					this.peerBuffers[ipAddressPort] = null

					// FIXME: Clean up this arraybuffer confusion mess
					const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
					let ctx = new ReadContext(arrayBuffer, false);

					// 	Notes on isBufferedService
					// 	some simple services (Directory, TimeSync, others..) 
					//	might receive data the is hard to parse with the buffer.
					// if isBufferedService is false, we send this data immediately to parse.
					if (!this.isBufferedService) {
						const parsedData = this.parseData(new ReadContext(ctx.readRemainingAsNewArrayBuffer(),false), socket);
						this.messageHandler(parsedData);
						this.emit('message', parsedData);
					};
					
					//	Check if device has announced itself to this service yet
					// 	Basically, we only want to handle 
					if (!deviceId && ctx.sizeLeft() >= 20) { 
						
						const messageId = ctx.readUInt32();
						deviceId = new DeviceId(ctx.read(16));
						
						//peak at network string length then rewind and read string
						const stringLength = ctx.readUInt32();
						ctx.seek(-4);
						(assert (stringLength <= ctx.sizeLeft()));
						const serviceName = ctx.readNetworkStringUTF16();
						
						//make sure reading port won't overrun buffer
						(assert (ctx.sizeLeft() >= 2));
						ctx.readUInt16(); //read port, though we don't need it
						
						this.parent.sockets[deviceId.toString()].set(this.name, socket);
						this.peerDeviceIds[ipAddressPort] = deviceId;
						//this.peerSockets.set(deviceId,socket);
						this._peerSockets[deviceId.toString()] = socket;
						
						Logger.silent(`${MessageId[messageId]} to ${serviceName} from ${deviceId.toString()}`);
						
						const parsedData = this.parseServiceData(messageId, deviceId, serviceName, socket);
						this.messageHandler(parsedData);
						//this.emit('message', parsedData);
					} 
					
					try {
						while (ctx.isEOF() === false) {
							
							if (ctx.sizeLeft() < 4) {
								this.peerBuffers[ipAddressPort] = ctx.readRemainingAsNewBuffer();
								break;
							}

							const length = ctx.readUInt32();
							if ( length <= ctx.sizeLeft()) {
								
								const message = ctx.read(length);
								// Use slice to get an actual copy of the message instead of working on the shared underlying ArrayBuffer
								const data = message.buffer.slice(message.byteOffset, message.byteOffset + length);
								
								this.msgId++
								const parsedData = this.parseData(new ReadContext(data,false), socket);
								
								this.messageHandler(parsedData);
								this.emit('message', parsedData);
							} else {
								ctx.seek(-4); // Rewind 4 bytes to include the length again
								this.peerBuffers[ipAddressPort] = ctx.readRemainingAsNewBuffer();
								break;
							}
							msgId.incrementLoopId();
						}
					} catch (err) {
						Logger.error(this.name, deviceId.toString(), err);
					}
				});
			}).listen(0, '0.0.0.0', () => {
				this.serverStatus = true;
				this.serverInfo = server.address() as net.AddressInfo;
				this.server = server;
				Logger.silly(`opened ${this.name} server on ${this.serverInfo.port}`);
				if (this.expectedDeviceId){
					Logger.silly(`started timer for ${this.name} for ${this.expectedDeviceId}`)
					this.timeout = setTimeout(this.closeService, 5000, this.expectedDeviceId, this.name, this.server, this.parent);
				};
				resolve(server);
			});
		});
	}

	async listen(): Promise<AddressInfo> {
		const server = await this.createServer()
		return server.address() as AddressInfo;
	}
	
	closeServer() {
		assert(this.server);
		try {
			this.server.close();
		} catch (e) {
			Logger.error('Error closing server', e);
		} 
	}

	getDeviceIdFromSocket(socket: Socket): DeviceId {
		return this.peerDeviceIds[[socket.remoteAddress, socket.remotePort].join(':')]
	}

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

	protected testPoint(_ctx: ReadContext, deviceId: string, name: string, silent?:boolean) {
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
			Logger.silent(`[${this.name}] ${deviceId} (${name}) ${length} ${buff}`);
		} else {
			Logger.debug(`[${this.name}] ${deviceId} (${name}) ${length} ${buff}`);
		}
	}

	//	callback for timeout timer
	protected async closeService(deviceId: DeviceId, serviceName: string, server: Server, parent: InstanceType<typeof StageLinq>) {
		Logger.debug(`closing ${serviceName} server for ${deviceId.toString()} due to timeout`);
		await server.close();
		parent.services[deviceId.toString()].delete(serviceName);
	}

	// FIXME: Cannot use abstract because of async; is there another way to get this?
	protected async init() {
		assert.fail('Implement this');
	}

	protected abstract parseServiceData(messageId:number, deviceId: DeviceId, serviceName: string, socket: Socket): ServiceMessage<T>;

	protected abstract parseData(p_ctx: ReadContext, socket: Socket): ServiceMessage<T>;

	protected abstract messageHandler(p_data: ServiceMessage<T>): void;
}
