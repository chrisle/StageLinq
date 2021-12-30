import { strict as assert } from 'assert';
import { Action, MessageId, CLIENT_TOKEN, DISCOVERY_MESSAGE_MARKER, LISTEN_PORT, LISTEN_TIMEOUT } from './common';
import { createSocket, RemoteInfo } from 'dgram';
import { ReadContext } from './utils/ReadContext';
import { WriteContext } from './utils/WriteContext';
import { sleep } from './utils/sleep';
import * as FileType from 'file-type';
import * as tcp from './utils/tcp';
import * as services from './services';
import * as fs from 'fs';
import Database = require('better-sqlite3');

interface ConnectionInfo extends DiscoveryMessage {
	address: string;
}

function readConnectionInfo(p_ctx: ReadContext, p_address: string): ConnectionInfo {
	const magic = p_ctx.getString(4);
	if (magic !== DISCOVERY_MESSAGE_MARKER) {
		return null;
	}

	const result: ConnectionInfo = {
		token: p_ctx.read(16),
		source: p_ctx.readNetworkStringUTF16(),
		action: p_ctx.readNetworkStringUTF16(),
		software: {
			name: p_ctx.readNetworkStringUTF16(),
			version: p_ctx.readNetworkStringUTF16(),
		},
		port: p_ctx.readUInt16(),
		address: p_address,
	};
	assert(p_ctx.isEOF());
	return result;
}

async function discover(): Promise<ConnectionInfo> {
	return await new Promise((resolve, reject) => {
		const client = createSocket('udp4');
		client.on('message', (p_announcement: Uint8Array, p_remote: RemoteInfo) => {
			const ctx = new ReadContext(p_announcement.buffer, false);
			const result = readConnectionInfo(ctx, p_remote.address);
			if (result === null || result.source === 'testing' || result.software.name === 'OfflineAnalyzer') {
				return;
			}
			client.close();
			assert(ctx.tell() === p_remote.size);
			assert(result.action === Action.Login);
			console.info(
				`Found '${result.source}' Controller at '${result.address}:${result.port}' with following software:`,
				result.software
			);

			resolve(result);
		});
		client.bind(LISTEN_PORT);

		setTimeout(() => {
			reject(new Error('Failed to find controller'));
		}, LISTEN_TIMEOUT);
	});
}

// FIXME: Pretty sure this can be improved upon
interface Services {
	StateMap: services.StateMap;
	FileTransfer: services.FileTransfer;
}
type SupportedTypes = services.StateMap | services.FileTransfer;

interface SourceAndTrackPath {
	source: string;
	trackPath: string;
}

export class Controller {
	private connection: tcp.Connection = null;
	//private source: string = null;
	private address: string = null;
	private port: number = 0;
	private servicePorts: ServicePorts = {};
	private services: Services = {
		StateMap: null,
		FileTransfer: null,
	};
	private timeAlive: number = 0;
	private connectedSources: {
		[key: string]: {
			db: Database.Database;
			albumArt: {
				path: string;
				extensions: {
					[key: string]: string;
				};
			};
		};
	} = {};

	///////////////////////////////////////////////////////////////////////////
	// Connect / Disconnect

	async connect(): Promise<void> {
		const info = await discover();
		this.connection = await tcp.connect(info.address, info.port);
		this.connection.socket.on('data', (p_message: Buffer) => {
			this.messageHandler(p_message);
		});
		//this.source = info.source;
		this.address = info.address;
		this.port = info.port;

		await this.requestAllServicePorts();
	}

	disconnect(): void {
		// Disconnect all services
		for (const [key, service] of Object.entries(this.services)) {
			service.disconnect();
			this.services[key] = null;
		}

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

	getPort(): number {
		return this.port;
	}
	getTimeAlive(): number {
		return this.timeAlive;
	}

	// Factory function
	async connectToService<T extends SupportedTypes>(c: {
		new (p_address: string, p_port: number, p_controller: Controller): T;
	}): Promise<T> {
		assert(this.connection);

		const serviceName = c.name;

		if (this.services[serviceName]) {
			return this.services[serviceName];
		}

		assert(this.servicePorts.hasOwnProperty(serviceName));
		assert(this.servicePorts[serviceName] > 0);
		const port = this.servicePorts[serviceName];

		const service = new c(this.address, port, this);

		await service.connect();
		this.services[serviceName] = service;
		return service;
	}

	async addSource(p_sourceName: string, p_localDbPath: string, p_localAlbumArtPath: string) {
		if (this.connectedSources[p_sourceName]) {
			return;
		}
		const db = new Database(p_localDbPath);

		// Get all album art extensions
		const stmt = db.prepare('SELECT * FROM AlbumArt WHERE albumArt NOT NULL');
		const result = stmt.all();
		const albumArtExtensions = {};
		for (const entry of result) {
			const filetype = await FileType.fromBuffer(entry.albumArt);
			albumArtExtensions[entry.id] = filetype ? filetype.ext : null;
		}

		this.connectedSources[p_sourceName] = {
			db: db,
			albumArt: {
				path: p_localAlbumArtPath,
				extensions: albumArtExtensions,
			},
		};
	}

	async dumpAlbumArt(p_sourceName: string) {
		if (!this.connectedSources[p_sourceName]) {
			assert.fail(`Source '${p_sourceName}' not connected`);
			return;
		}
		const path = this.connectedSources[p_sourceName].albumArt.path;
		if (fs.existsSync(path) === false) {
			fs.mkdirSync(path, { recursive: true });
		}

		const result = await this.querySource(p_sourceName, 'SELECT * FROM AlbumArt WHERE albumArt NOT NULL');
		for (const entry of result) {
			const filetype = await FileType.fromBuffer(entry.albumArt);
			const ext = filetype ? '.' + filetype.ext : '';
			const filepath = `${path}/${entry.id}${ext}`;
			fs.writeFileSync(filepath, entry.albumArt);
		}
		console.info(`dumped ${result.length} albums arts in '${path}'`);
	}

	// Database helpers

	querySource(p_sourceName: string, p_query: string, ...p_params: any[]): any[] {
		if (!this.connectedSources[p_sourceName]) {
			//assert.fail(`Source '${p_sourceName}' not connected`);
			return [];
		}
		const db = this.connectedSources[p_sourceName].db;
		const stmt = db.prepare(p_query);

		return stmt.all(p_params);
	}

	getAlbumArtPath(p_networkPath: string): string {
		const result = this.getSourceAndTrackFromNetworkPath(p_networkPath);
		const sql = 'SELECT * FROM Track WHERE path = ?';
		const dbResult = this.querySource(result.source, sql, result.trackPath);
		if (dbResult.length === 0) {
			return null;
		}

		assert(dbResult.length === 1); // there can only be one path
		const id = dbResult[0].idAlbumArt;
		const ext = this.connectedSources[result.source].albumArt.extensions[id];
		if (!ext) {
			return null;
		}

		return `${this.connectedSources[result.source].albumArt.path}${id}.${ext}`;
	}

	///////////////////////////////////////////////////////////////////////////
	// Private methods

	private getSourceAndTrackFromNetworkPath(p_path: string): SourceAndTrackPath {
		if (p_path.length === 0) {
			return null;
		}

		const parts = p_path.split('/');
		//assert(parts.length > )
		assert(parts[0] === 'net:');
		assert(parts[1] === '');
		assert(parts[2].length === 36);
		const source = parts[3];
		let trackPath = parts.slice(5).join('/');
		if (parts[4] !== 'Engine Library') {
			// This probably occurs with RekordBox conversions; tracks are outside Engine Library folder
			trackPath = `../${parts[4]}/${trackPath}`;
		}
		return {
			source: source,
			trackPath: trackPath,
		};
	}

	private async requestAllServicePorts(): Promise<void> {
		assert(this.connection);
		return new Promise(async (resolve, reject) => {
			// FIXME: Refactor into message writer helper class
			const ctx = new WriteContext();
			ctx.writeUInt32(MessageId.ServicesRequest);
			ctx.write(CLIENT_TOKEN);
			const written = await this.connection.write(ctx.getBuffer());
			assert(written === ctx.tell());

			setTimeout(() => {
				reject(new Error('Failed to requestServices'));
			}, LISTEN_TIMEOUT);

			while (true) {
				// FIXME: How to determine when all services have been announced?
				if (Object.keys(this.servicePorts).length > 3) {
					console.info('Discovered the following services:');
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
