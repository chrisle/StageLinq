import { EventEmitter } from 'events';
import { Logger } from '../LogEmitter';
import { MessageId, MESSAGE_TIMEOUT, DeviceId, Device } from '../types';
import { ReadContext } from '../utils/ReadContext';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import {Server, Socket, AddressInfo} from 'net';
import * as net from 'net';
import type { ServiceMessage } from '../types';
import { StageLinq } from '../StageLinq';


export declare type ServiceData = {
	name?: string;
	socket?: Socket;
	deviceId?: DeviceId;
	service?: InstanceType<typeof Service>;
}

export abstract class ServiceHandler<T> extends EventEmitter {
	public name: string;
	protected parent: InstanceType<typeof StageLinq>;
	private _devices: Map<string, Service<T>> = new Map();
	

	constructor(p_parent:InstanceType<typeof StageLinq>, serviceName: string) {
		super();
		this.parent = p_parent;
		this.name = serviceName;
		this.parent.services[serviceName] = this;
	}

	hasDevice(deviceId: DeviceId): boolean {
		return this._devices.has(deviceId.string)
	}

	getDevice(deviceId: DeviceId): Service<T>  {
		return this._devices.get(deviceId.string);
	}

	getDevices(): Service<T>[] {
		return [...this._devices.values()]
	}

	addDevice(deviceId: DeviceId, service: Service<T>) {
		this._devices.set(deviceId.string, service)
	}

	deleteDevice(deviceId: DeviceId) {
		this._devices.delete(deviceId.string)
	}

	async startServiceListener<T extends InstanceType<typeof Service>>(ctor: {
		new (_parent: InstanceType<typeof StageLinq>, _serviceHandler?: any, _deviceId?: DeviceId): T;
	  }, parent?: InstanceType<typeof StageLinq>, deviceId?: DeviceId): Promise<T> {
		
		const service = new ctor(parent, this, deviceId);
		await service.listen();
		if (deviceId) {
			this.parent.devices.addService(deviceId, service)
		}

		this.setupService(service, deviceId)

		let serverName = `${ctor.name}`;

		if (deviceId) {
			serverName += deviceId.string;
		}

		this.parent.addServer(serverName, service.server);

		return service;
	}

	protected abstract setupService(service: InstanceType<typeof Service>, deviceId?: DeviceId): void;
}


export abstract class Service<T> extends EventEmitter {
	public readonly name: string = "Service";
	public readonly device: Device;
	public deviceId: DeviceId = null;
	public server: Server = null;
	public serverInfo: AddressInfo;
	public serverStatus: boolean = false;
	public socket: Socket = null;

	//TODO figure out removing this second DeviceId
	protected _deviceId: DeviceId = null;
	
	protected isBufferedService: boolean = true;
	protected parent: InstanceType<typeof StageLinq>;
	protected _handler: ServiceHandler<T> = null;

	
	protected timeout: NodeJS.Timer;

	private messageBuffer: Buffer = null;
	
	constructor(p_parent:InstanceType<typeof StageLinq>, serviceHandler: InstanceType <typeof ServiceHandler>, deviceId?: DeviceId) {
		super();
		this.parent = p_parent;
		this._handler = serviceHandler as ServiceHandler<T>;
		this.deviceId = deviceId || null;
		this.device = (deviceId ? this.parent.devices.device(deviceId) : null);
	}
	
	async createServer(): Promise<Server> {
		return await new Promise((resolve, reject) => {
			
			const server = net.createServer( (socket) => {
				
				Logger.debug(`[${this.name}] connection from ${socket.remoteAddress}:${socket.remotePort}`)
				clearTimeout(this.timeout);
				this.socket = socket;
				
				if (this.name !== "Directory") {
					const handler = this._handler as ServiceHandler<T>;
	
					handler.emit('connection', this.name, this.deviceId)
					if (this.deviceId) {
						handler.addDevice(this.deviceId, this)
					}
				}

				socket.on('error', (err) => {
					reject(err);
				});
				
				socket.on('data', async p_data => {
					await this.dataHandler(p_data, socket)
				});

			}).listen(0, '0.0.0.0', () => {
				this.serverStatus = true;
				this.serverInfo = server.address() as net.AddressInfo;
				this.server = server;
				Logger.silly(`opened ${this.name} server on ${this.serverInfo.port}`);
				if (this.deviceId){
					Logger.silly(`started timer for ${this.name} for ${this.deviceId}`)
					this.timeout = setTimeout(this.closeService, 5000, this.deviceId, this.name, this.server, this.parent, this._handler);
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

	private async dataHandler(p_data: Buffer, socket: Socket) {

		// Concantenate messageBuffer with current data
		let buffer: Buffer = null;
		if ( this.messageBuffer && this.messageBuffer.length > 0) {
			buffer = Buffer.concat([this.messageBuffer, p_data]);
		} else {
			buffer = p_data;
		}
		this.messageBuffer = null

		// TODO: Clean up this arraybuffer confusion mess
		const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
		let ctx = new ReadContext(arrayBuffer, false);

	
		// 	Notes on isBufferedService
		// 	some simple services (Directory, TimeSync, others..) 
		//	might receive data the is hard to parse with the buffer.
		// if isBufferedService is false, we send this data immediately to parse.
		if (!this.isBufferedService) {
			const parsedData = this.parseData(new ReadContext(ctx.readRemainingAsNewArrayBuffer(),false), socket);
			this.messageHandler(parsedData);
		};
		
		//	Check if device has announced itself to this service yet
		// 	Basically, we only want to handle first msg sent to non-directory services
		if (!this._deviceId && ctx.sizeLeft() >= 20) { 
			
			const messageId = ctx.readUInt32();
			this._deviceId = new DeviceId(ctx.read(16));
			
			//peak at network string length then rewind and read string
			const stringLength = ctx.readUInt32();
			ctx.seek(-4);

			(assert (stringLength <= ctx.sizeLeft()));
			const serviceName = ctx.readNetworkStringUTF16();
			
			//make sure reading port won't overrun buffer
			(assert (ctx.sizeLeft() >= 2));
			ctx.readUInt16(); //read port, though we don't need it
			
			Logger.silent(`${MessageId[messageId]} to ${serviceName} from ${this.deviceId.string}`);
			if (this.device) {
				this.device.parent.emit('newService', this.device, this)
			}
			const parsedData = this.parseServiceData(messageId, this.deviceId, serviceName, socket);
			this.messageHandler(parsedData);
		} 
		
		try {
			while (ctx.isEOF() === false) {
				if (ctx.sizeLeft() < 4) {
					this.messageBuffer = ctx.readRemainingAsNewBuffer();
					break;
				}

				const length = ctx.readUInt32();
				if ( length <= ctx.sizeLeft()) {	
					
					const message = ctx.read(length);
					if (!message) {
						Logger.warn(message)
					}
					// Use slice to get an actual copy of the message instead of working on the shared underlying ArrayBuffer
					const data = message.buffer.slice(message.byteOffset, message.byteOffset + length);
					const parsedData = this.parseData(new ReadContext(data,false), socket);
					this.messageHandler(parsedData);
					
				} else {
					ctx.seek(-4); // Rewind 4 bytes to include the length again
					this.messageBuffer = ctx.readRemainingAsNewBuffer();
					break;
				}
			}
		} catch (err) {
			Logger.error(this.name, this.deviceId.string, err);
		}
	}

	async waitForMessage(message: string, p_messageId: number): Promise<T> {
		return await new Promise((resolve, reject) => {
			const listener = (p_message: ServiceMessage<T>) => {
				if (p_message.id === p_messageId) {
					this.removeListener(message, listener);
					resolve(p_message.message);
				}
			};
			this.addListener(message, listener);
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

	//	callback for timeout timer
	protected async closeService(deviceId: DeviceId, serviceName: string, server: Server, parent: InstanceType<typeof StageLinq>, handler: ServiceHandler<T>) {
		Logger.debug(`closing ${serviceName} server for ${deviceId.string} due to timeout`);
		
		await server.close();
		
		const serverName = `${serviceName}${deviceId.string}`;
		parent.deleteServer(serverName);
		
		await handler.deleteDevice(deviceId);
		assert(!handler.hasDevice(deviceId));
		
		const service = parent.services[serviceName]
		parent.devices.deleteService(deviceId, serviceName);
		await service.deleteDevice(deviceId);
		assert(!service.hasDevice(deviceId));
	}

	protected abstract parseServiceData(messageId:number, deviceId: DeviceId, serviceName: string, socket: Socket): ServiceMessage<T>;

	protected abstract parseData(p_ctx: ReadContext, socket: Socket): ServiceMessage<T>;

	protected abstract messageHandler(p_data: ServiceMessage<T>): void;
}
