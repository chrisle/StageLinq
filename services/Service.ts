//import { hex } from '../utils/hex';
import { EventEmitter } from 'events';
import { Logger } from '../LogEmitter';
import { MessageId, MESSAGE_TIMEOUT, Tokens } from '../types';
import { NetworkDevice } from '../network/NetworkDevice';
import { ReadContext } from '../utils/ReadContext';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import * as tcp from '../utils/tcp';
import type { ServiceMessage } from '../types';

export abstract class Service<T> extends EventEmitter {
	private address: string;
	private port: number;
	public readonly name: string;
	protected controller: NetworkDevice;
	protected connection: tcp.Connection = null;

	constructor(p_address: string, p_port: number, p_controller: NetworkDevice) {
		super();
		this.address = p_address;
		this.port = p_port;
		this.name = this.constructor.name;
		this.controller = p_controller;
	}

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
		ctx.writeUInt16(this.connection.socket.localPort); // FIXME: In the Go code this is the local TCP port, but 0 or any other 16 bit value seems to work fine as well
		await this.write(ctx);

		await this.init();

		Logger.debug(`Connected to service '${this.name}' at port ${this.port}`);
	}

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
		assert(written === buf.byteLength);
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

	// FIXME: Cannot use abstract because of async; is there another way to get this?
	protected async init() {
		assert.fail('Implement this');
	}

	protected abstract parseData(p_ctx: ReadContext): ServiceMessage<T>;

	protected abstract messageHandler(p_data: ServiceMessage<T>): void;
}
