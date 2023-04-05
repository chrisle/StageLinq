import { EventEmitter } from 'events';
import { Logger } from '../LogEmitter';
import { MessageId, MESSAGE_TIMEOUT } from '../types';
import { DeviceId, Device } from '../devices'
import { ReadContext } from '../utils/ReadContext';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import { Server, Socket, AddressInfo } from 'net';
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

	/**
	 * ServiceHandler Abstract Class
	 * @constructor
	 * @param {StageLinq} parent 
	 * @param {string} serviceName 
	 */

	constructor(parent: StageLinq, serviceName: string) {
		super();
		this.parent = parent;
		this.name = serviceName;
		this.parent.services[serviceName] = this;
	}

	/**
	 * Check if Service Handler has Device
	 * @param {DeviceId} deviceId 
	 * @returns {boolean}
	 */
	hasDevice(deviceId: DeviceId): boolean {
		return this._devices.has(deviceId.string)
	}

	/**
	 * Get an attached device from Service Handler
	 * @param {DeviceId} deviceId 
	 * @returns {Service<T>}
	 */
	getDevice(deviceId: DeviceId): Service<T> {
		return this._devices.get(deviceId.string);
	}

	/**
	 * Get all attached devices from Service Handler
	 * @returns {Service<T>[]}
	 */
	getDevices(): Service<T>[] {
		return [...this._devices.values()]
	}

	/**
	 * Add a Device to Service Handler
	 * @param {DeviceId} deviceId 
	 * @param {Service<T>} service 
	 */
	addDevice(deviceId: DeviceId, service: Service<T>) {
		this._devices.set(deviceId.string, service)
	}

	/**
	 * Remove a Device from Service Handler 
	 * @param {DeviceId} deviceId 
	 */
	deleteDevice(deviceId: DeviceId) {
		this._devices.delete(deviceId.string)
	}

	/**
	 * Start new service factory function
	 * @param {Service<T>} ctor 
	 * @param {StageLinq} parent 
	 * @param {DeviceId} deviceId 
	 * @returns {Service<T>}
	 */
	async startServiceListener<T extends InstanceType<typeof Service>>(ctor: {
		new(_parent: InstanceType<typeof StageLinq>, _serviceHandler?: any, _deviceId?: DeviceId): T;
	}, parent?: InstanceType<typeof StageLinq>, deviceId?: DeviceId): Promise<T> {

		const service = new ctor(parent, this, deviceId);
		await service.listen();

		let serverName = `${ctor.name}`;
		if (deviceId) {
			this.parent.devices.addService(deviceId, service)
			serverName += deviceId.string;
		}
		this.setupService(service, deviceId)

		this.parent.addServer(serverName, service.server);
		return service;
	}

	protected abstract setupService(service: any, deviceId?: DeviceId): void;
}


export abstract class Service<T> extends EventEmitter {
	public readonly name: string = "Service";
	public readonly device: Device;
	public deviceId: DeviceId = null;
	public server: Server = null;
	public serverInfo: AddressInfo;
	public serverStatus: boolean = false;
	public socket: Socket = null;

	protected isBufferedService: boolean = true;
	protected parent: StageLinq;
	protected _handler: ServiceHandler<T> = null;
	protected timeout: NodeJS.Timer;

	private messageBuffer: Buffer = null;

	/**
	 * Service Abstract Class
	 * @param {StageLinq} parent 
	 * @param {ServiceHandler<T>} serviceHandler 
	 * @param {DeviceId} deviceId 
	 */
	constructor(parent: StageLinq, serviceHandler: InstanceType<typeof ServiceHandler>, deviceId?: DeviceId) {
		super();
		this.parent = parent;
		this._handler = serviceHandler as ServiceHandler<T>;
		this.deviceId = deviceId || null;
		this.device = (deviceId ? this.parent.devices.device(deviceId) : null);
	}

	/**
	 * Creates a new Net.Server for Service
	 * @returns {Server}
	 */
	async createServer(): Promise<Server> {
		return await new Promise((resolve, reject) => {

			const server = net.createServer((socket) => {

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

				socket.on('data', async data => {
					await this.dataHandler(data, socket)
				});

			}).listen(0, '0.0.0.0', () => {
				this.serverStatus = true;
				this.serverInfo = server.address() as net.AddressInfo;
				this.server = server;
				Logger.silly(`opened ${this.name} server on ${this.serverInfo.port}`);
				if (this.deviceId) {
					Logger.silly(`started timer for ${this.name} for ${this.deviceId.string}`)
					this.timeout = setTimeout(this.closeService, 5000, this.deviceId, this.name, this.server, this.parent, this._handler);
				};
				resolve(server);
			});
		});
	}

	/**
	 * Start Service Listener
	 * @returns {Promise<AddressInfo>}
	 */
	async listen(): Promise<AddressInfo> {
		const server = await this.createServer();
		return server.address() as net.AddressInfo;
	}

	/**
	 * Close Server
	 */
	closeServer() {
		assert(this.server);
		try {
			this.server.close();
		} catch (e) {
			Logger.error('Error closing server', e);
		}
	}

	private async subMessageTest(buff: Buffer): Promise<boolean> {
		try {
			const msg = buff.readInt32BE();
			const deviceId = buff.slice(4);
			if (msg === 0 && deviceId.length === 16) {
				return true
			} else {
				return false
			}
		} catch {
			return false
		}
	}

	/**
	 * Handle incoming Data from Server Socket
	 * @param {Buffer} data 
	 * @param {Socket} socket 
	 */
	private async dataHandler(data: Buffer, socket: Socket) {
		// Concantenate messageBuffer with current data
		let buffer: Buffer = null;
		if (this.messageBuffer && this.messageBuffer.length > 0) {
			buffer = Buffer.concat([this.messageBuffer, data]);
		} else {
			buffer = data;
		}
		this.messageBuffer = null

		// TODO: Clean up this arraybuffer confusion mess
		const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
		let ctx = new ReadContext(arrayBuffer, false);

		if (!this.isBufferedService) {
			const parsedData = this.parseData(new ReadContext(ctx.readRemainingAsNewArrayBuffer(), false), socket);
			this.messageHandler(parsedData);
		};

		if (await this.subMessageTest(ctx.peek(20))) {

			const messageId = ctx.readUInt32();
			const token = ctx.read(16) // DeviceID
			if (!this.deviceId) {
				const deviceId = new DeviceId(token);
				Logger.silent(`${this.name} adding DeviceId: ${deviceId.string}`)
				this.deviceId = deviceId
			}
			//peak at network string length then rewind and read string
			const stringLength = ctx.readUInt32();
			ctx.seek(-4);

			(assert(stringLength <= ctx.sizeLeft()));
			const serviceName = ctx.readNetworkStringUTF16();

			//make sure reading port won't overrun buffer
			(assert(ctx.sizeLeft() >= 2));
			ctx.readUInt16(); //read port, though we don't need it

			Logger.silent(`${MessageId[messageId]} to ${serviceName} from ${this.deviceId.string}`);
			if (this.device) {
				this.device.parent.emit('newService', this.device, this)
			}
			this.emit('newDevice', this);
		}

		try {
			while (ctx.isEOF() === false) {
				if (ctx.sizeLeft() < 4) {
					this.messageBuffer = ctx.readRemainingAsNewBuffer();
					break;
				}

				const length = ctx.readUInt32();
				if (length <= ctx.sizeLeft()) {

					const message = ctx.read(length);
					if (!message) {
						Logger.warn(message)
					}
					// Use slice to get an actual copy of the message instead of working on the shared underlying ArrayBuffer
					const data = message.buffer.slice(message.byteOffset, message.byteOffset + length);
					const parsedData = this.parseData(new ReadContext(data, false), socket);
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

	/**
	 * Wait for a message from the wire
	 * @param {string} eventMessage 
	 * @param {number} messageId 
	 * @returns {Promise<T>}
	 */
	async waitForMessage(eventMessage: string, messageId: number): Promise<T> {
		return await new Promise((resolve, reject) => {
			const listener = (message: ServiceMessage<T>) => {
				if (message.id === messageId) {
					this.removeListener(eventMessage, listener);
					resolve(message.message);
				}
			};
			this.addListener(eventMessage, listener);
			setTimeout(() => {
				reject(new Error(`Failed to receive message '${messageId}' on time`));
			}, MESSAGE_TIMEOUT);
		});
	}

	/**
	 * Write a Context message to the socket
	 * @param {WriteContext} ctx 
	 * @returns {Promise<boolean>} true if data written
	 */
	async write(ctx: WriteContext): Promise<boolean> {
		assert(ctx.isLittleEndian() === false);
		const buf = ctx.getBuffer();
		const written = await this.socket.write(buf);
		return await written;
	}

	/**
	 * Write a length-prefixed Context message to the socket
	 * @param {WriteContext} ctx 
	 * @returns {Promise<boolean>} true if data written
	 */
	async writeWithLength(ctx: WriteContext): Promise<boolean> {
		assert(ctx.isLittleEndian() === false);
		const newCtx = new WriteContext({ size: ctx.tell() + 4, autoGrow: false });
		newCtx.writeUInt32(ctx.tell());
		newCtx.write(ctx.getBuffer());
		assert(newCtx.isEOF());
		return await this.write(newCtx);
	}

	//	
	/**
	 * Callback for server timeout timer
	 * Runs if device doesn't conect to service server
	 * @param {DeviceId} deviceId 
	 * @param {string} serviceName 
	 * @param {Server} server 
	 * @param {StageLinq} parent 
	 * @param {ServiceHandler} handler 
	 */
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

	protected abstract parseData(ctx: ReadContext, socket: Socket): ServiceMessage<T>;

	protected abstract messageHandler(data: ServiceMessage<T>): void;
}
