import { EventEmitter } from 'events';
import { Logger } from '../LogEmitter';
import { MessageId, MESSAGE_TIMEOUT, DeviceId } from '../types';
import { ReadContext } from '../utils/ReadContext';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import {Server, Socket, AddressInfo} from 'net';
import * as net from 'net';
import type { ServiceMessage } from '../types';
import { StageLinq } from '../StageLinq';


export declare type ServiceData = {
	socket?: Socket;
	deviceId?: DeviceId;
	service?: InstanceType<typeof Service>;
}

export abstract class Service<T> extends EventEmitter {
	public readonly name: string = "Service";
	public deviceId: DeviceId = null;
	protected _deviceId: DeviceId = null;

	protected isBufferedService: boolean = true;
	protected parent: InstanceType<typeof StageLinq>;
	
	public server: Server = null;
	public serverInfo: AddressInfo;
	public serverStatus: boolean = false;
	public socket: Socket = null;

	protected timeout: NodeJS.Timer;

	private messageBuffer: Buffer = null;
	
	constructor(p_parent:InstanceType<typeof StageLinq>, deviceId?: DeviceId) {
		super();
		this.parent = p_parent;
		this.deviceId = deviceId || null;
	}
	
	async createServer(): Promise<Server> {
		return await new Promise((resolve, reject) => {
			
			const server = net.createServer( (socket) => {
				
				Logger.debug(`[${this.name}] connection from ${socket.remoteAddress}:${socket.remotePort}`)
				clearTimeout(this.timeout);
				
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
					this.timeout = setTimeout(this.closeService, 5000, this.deviceId, this.name, this.server, this.parent);
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

		//append queue to current data
		let buffer: Buffer = null;
		if ( this.messageBuffer && this.messageBuffer.length > 0) {
			buffer = Buffer.concat([this.messageBuffer, p_data]);
		} else {
			buffer = p_data;
		}
		this.messageBuffer = null

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
			//todo fix sockets
			this.parent.sockets[this.deviceId.toString()].set(this.name, socket);
			
			Logger.silent(`${MessageId[messageId]} to ${serviceName} from ${this.deviceId.toString()}`);
			
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
						console.log(message)
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
			Logger.error(this.name, this.deviceId.toString(), err);
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
	protected async closeService(deviceId: DeviceId, serviceName: string, server: Server, parent: InstanceType<typeof StageLinq>) {
		Logger.silly(`closing ${serviceName} server for ${deviceId.toString()} due to timeout`);
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
