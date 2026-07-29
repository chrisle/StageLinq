import { EventEmitter } from 'events';
import type { Logger } from '../types/logger';
import { noopLogger } from '../types/logger';
import { MessageId, MESSAGE_TIMEOUT, Tokens } from '../types';
import { NetworkDevice } from '../network/NetworkDevice';
import { ReadContext } from '../utils/ReadContext';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import * as tcp from '../utils/tcp';
import type { ServiceMessage } from '../types';
import { getConfig } from '../config';

export abstract class Service<T> extends EventEmitter {
	private address: string;
	private port: number;
	public readonly name: string;
	protected controller: NetworkDevice;
	protected connection: tcp.Connection | null = null;
	protected logger: Logger;
	/** Trailing bytes of a partially-received message, held for the next read. */
	private queue: Buffer | null = null;

	constructor(p_address: string, p_port: number, p_controller: NetworkDevice, logger: Logger = noopLogger) {
		super();
		this.address = p_address;
		this.port = p_port;
		this.name = this.constructor.name;
		this.controller = p_controller;
		this.logger = logger;
	}

	/**
	 * Split one TCP read into length-prefixed messages and dispatch each.
	 *
	 * Any trailing partial message is held in `queue` and prepended to the next
	 * read. Parsing a single message is isolated so that one malformed or
	 * unsupported message costs only itself — previously a throw unwound past
	 * the framing loop, discarding every later message in the same read *and*
	 * the pending `queue`, which corrupted reassembly rather than skipping a
	 * message.
	 */
	protected handleData(p_data: Buffer): void {
		const buffer = this.queue && this.queue.length > 0 ? Buffer.concat([this.queue, p_data]) : p_data;

		// FIXME: Clean up this arraybuffer confusion mess
		const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
		const ctx = new ReadContext(arrayBuffer, false);
		this.queue = null;

		try {
			while (ctx.isEOF() === false) {
				if (ctx.sizeLeft() < 4) {
					this.queue = ctx.readRemainingAsNewBuffer();
					break;
				}

				const length = ctx.readUInt32();
				if (length > ctx.sizeLeft()) {
					ctx.seek(-4); // Rewind 4 bytes to include the length again
					this.queue = ctx.readRemainingAsNewBuffer();
					break;
				}

				const message = ctx.read(length);
				// Use slice to get an actual copy of the message instead of working on the shared underlying ArrayBuffer
				const data = message.buffer.slice(message.byteOffset, message.byteOffset + length);
				const networkTap = getConfig().networkTap;
				if (networkTap) {
					networkTap({
						direction: 'recv',
						service: this.name,
						address: this.address,
						port: this.port,
						data: message,
					});
				}

				try {
					const parsedData = this.parseData(new ReadContext(data, false));

					// Forward parsed data to message handler
					if (parsedData) {
						this.messageHandler(parsedData);
						this.emit('message', parsedData);
					}
				} catch (err) {
					// Skip this message only; framing and `queue` are outside this catch.
					this.logger.error(err instanceof Error ? err.message : String(err));
				}
			}
		} catch (err) {
			// Framing itself failed — the read is unusable, so drop it rather than
			// letting the throw escape into the socket's 'data' handler.
			this.logger.error(err instanceof Error ? err.message : String(err));
		}
	}

	async connect(): Promise<void> {
		assert(!this.connection);
		this.connection = await tcp.connect(this.address, this.port);
		this.queue = null;

		this.connection.socket.on('data', (p_data: Buffer) => this.handleData(p_data));

		// FIXME: Is this required for all Services?
		const ctx = new WriteContext();
		ctx.writeUInt32(MessageId.ServicesAnnouncement);
		ctx.write(Tokens.SoundSwitch);
		ctx.writeNetworkStringUTF16(this.name);
		ctx.writeUInt16(this.connection.socket.localPort ?? 0); // FIXME: In the Go code this is the local TCP port, but 0 or any other 16 bit value seems to work fine as well
		await this.write(ctx);

		await this.init();

		this.logger.debug(`Connected to service '${this.name}' at port ${this.port}`);
	}

	disconnect() {
		assert(this.connection);
		try {
			this.logger.debug(`Disconnecting ${this.name} Service on ${this.address}`);
			this.connection.destroy();
		} catch (e) {
			this.logger.error('Error disconnecting', e);
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
		const networkTap = getConfig().networkTap;
		if (networkTap) {
			networkTap({
				direction: 'send',
				service: this.name,
				address: this.address,
				port: this.port,
				data: buf,
			});
		}
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

	protected abstract parseData(p_ctx: ReadContext): ServiceMessage<T> | null;

	protected abstract messageHandler(p_data: ServiceMessage<T>): void;
}
