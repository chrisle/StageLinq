import { strict as assert } from 'assert';
import { CLIENT_TOKEN, MessageId } from "../common";
import { ReadContext } from "../utils/ReadContext";
import { WriteContext } from "../utils/WriteContext";
import * as tcp from "../utils/tcp";

export class Service {
	private name: string;
	private source: string;
	private port: number;
	protected connection: tcp.Connection = null;
	protected messageHandler: MessageHandler = null;

	constructor(p_name: string, p_source: string, p_port: number, p_messageHandler: MessageHandler) {
		this.name = p_name;
		this.source = p_source;
		this.port = p_port;
		this.messageHandler = p_messageHandler;
	}

	async connect(): Promise<void> {
		assert(!this.connection);
		this.connection = await tcp.connect(this.source, this.port);
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
						const parsedData = this.parseData(new ReadContext(message.buffer.slice(message.byteOffset, message.byteOffset + length), false));

						// Forward parsed data to optional message handler
						if (this.messageHandler) {
							this.messageHandler(parsedData);
						}
					} else {
						ctx.seek(-4); // Rewind 4 bytes to include the length again
						queue = ctx.readRemainingAsNewBuffer();
						break;
					}
				}
			} catch (err) {
				// FIXME: Rethrow based on the severity?
				console.error(err);
			}
		});

		// FIXME: Is this required for all Services?
		const ctx = new WriteContext({littleEndian: false});
		ctx.writeUInt32(MessageId.ServicesAnnouncement);
		ctx.write(CLIENT_TOKEN);
		ctx.writeNetworkStringUTF16(this.name);
		ctx.writeUInt16(0); // FIXME: In the Go code this is the local TCP port, but 0 or any other 16 bit value seems to work fine as well
		const written = await this.connection.write(ctx.getBuffer());
		assert(written === ctx.tell());

		await this.init();

		console.info(`Connected to service '${this.name}' at port ${this.port}`);
	}

	disconnect() {
		assert(this.connection);
		this.connection.destroy();
		this.connection = null;
	}

	// FIXME: Cannot use abstract because of async; is there another way to get this
	async init() {
		assert.fail("Implement this");
	}

	parseData(p_ctx: ReadContext): object {
		assert.fail("Implement this" + p_ctx);
		return null;
	}
}