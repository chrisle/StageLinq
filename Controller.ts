import { strict as assert } from 'assert';
import { Action, MessageId, CLIENT_TOKEN, DISCOVERY_MESSAGE_MARKER, LISTEN_PORT, LISTEN_TIMEOUT } from './common';
import { createSocket, RemoteInfo } from 'dgram';
import { ReadContext } from './utils/ReadContext';
import { WriteContext } from './utils/WriteContext';
import * as tcp from './utils/tcp';
import { sleep } from './utils/sleep';
import * as services from './services';
import { Service } from './services/Service';

function readDiscoveryMessage(p_ctx: ReadContext): DiscoveryMessage {
	const magic = p_ctx.getString(4);
	if (magic !== DISCOVERY_MESSAGE_MARKER) {
		return null;
	}

	const result: DiscoveryMessage = {
		token: p_ctx.read(16),
		source: p_ctx.readNetworkStringUTF16(),
		action: p_ctx.readNetworkStringUTF16(),
		software: {
			name: p_ctx.readNetworkStringUTF16(),
			version: p_ctx.readNetworkStringUTF16()
		},
		port: p_ctx.readUInt16()
	}
	assert(p_ctx.isEOF());
	return result;
}

async function discover(): Promise<DiscoveryMessage> {
	return await new Promise((resolve, reject) => {
		const client = createSocket('udp4');
		client.on('message', (p_announcement: Uint8Array, p_remote: RemoteInfo) => {
			const ctx = new ReadContext(p_announcement.buffer, false);
			const result = readDiscoveryMessage(ctx);
			if (result === null || result.source === 'testing') {
				return;
			}
			client.close();
			assert(ctx.tell() === p_remote.size);
			assert(result.action === Action.Login);
			console.info(`Found '${result.source}' Controller at '${p_remote.address}:${result.port}' with following software:`, result.software);
			resolve(result);
		});
		client.bind(LISTEN_PORT);

		setTimeout(() => {
			reject(new Error("Failed to find controller"));
		}, LISTEN_TIMEOUT);
	});
}

interface Services {
	[key: string]: Service;
}

export class Controller {
	private connection: tcp.Connection = null;
	private source: string = null;
	private port: number = 0;
	private servicePorts: ServicePorts = {};
	private services: Services = {};
	private timeAlive: number = 0;

	///////////////////////////////////////////////////////////////////////////
	// Connect / Disconnect

	async connect(): Promise<void> {
		const announcement = await discover();
		this.connection = await tcp.connect(announcement.source, announcement.port);
		this.connection.socket.on('data', (p_message: Buffer) => {
			this.messageHandler(p_message)
		});
		this.source = announcement.source;
		this.port = announcement.port;

		await this.requestAllServicePorts();
	}

	disconnect(): void {
		// Disconnect all services
		for (const service of Object.values(this.services)) {
			service.disconnect();
		}
		this.services = {};

		assert(this.connection);
		this.connection.destroy();
		this.connection = null;
	}

	///////////////////////////////////////////////////////////////////////////
	// Message Handler

	messageHandler(p_message: Buffer): void {
		const ctx = new ReadContext(p_message.buffer, false);
		while (ctx.isEOF() === false) {
			const id = ctx.readUInt32();
			// FIXME: Verify token
			ctx.seek(16); // Skip token; present in all messages
			switch (id) {
				case MessageId.TimeStamp:
					ctx.seek(16); // Skip token; present in all messages
					// Time Alive is in nanoseconds; convert back to seconds
					this.timeAlive = Number(ctx.readUInt64() / (1000n * 1000n * 1000n));
				break;
				case MessageId.ServicesAnnouncement:
					const service = ctx.readNetworkStringUTF16();
					const port = ctx.readUInt16();
					this.servicePorts[service] = port;
				break;
				case MessageId.ServicesRequest:
				break;
				default:
					assert.fail(`Unhandled message id '${id}'`);
				break;
			}
		}
	}

	///////////////////////////////////////////////////////////////////////////
	// Public methods

	getPort(): number { return this.port; }
	getTimeAlive(): number { return this.timeAlive; }

	async connectToService(p_service: string, p_messageHandler?: MessageHandler): Promise<void> {
		assert(this.connection);

		if (this.services[p_service]) {
			return;
		}

		assert(this.servicePorts.hasOwnProperty(p_service));
		assert(this.servicePorts[p_service] > 0);
		const port = this.servicePorts[p_service];

		const service = new services[p_service](p_service, this.source, port, p_messageHandler);
		await service.connect();
		this.services[p_service] = service;
	}

	///////////////////////////////////////////////////////////////////////////
	// Private methods

	private async requestAllServicePorts(): Promise<void> {
		assert(this.connection);
		return new Promise(async (resolve, reject) => {
			// FIXME: Refactor into message writer helper class
			const ctx = new WriteContext({littleEndian: false});
			ctx.writeUInt32(MessageId.ServicesRequest);
			ctx.write(CLIENT_TOKEN);
			const written = await this.connection.write(ctx.getBuffer());
			assert(written === ctx.tell());

			setTimeout(() => {
				reject(new Error("Failed to requestServices"));
			}, LISTEN_TIMEOUT);

			while (true) {
				// FIXME: How to determine when all services have been announced?
				if (Object.keys(this.servicePorts).length > 3) {
					console.info("Discovered the following services:");
					for (const [name, port] of Object.entries(this.servicePorts)) {
						console.info(`\tport: ${port} => ${name}`);
					}
					resolve();
					break;
				}
				await sleep(250);
			}
		});
	}
}

