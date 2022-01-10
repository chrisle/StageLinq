import { strict as assert } from 'assert';
import { Action, DISCOVERY_MESSAGE_MARKER, LISTEN_PORT, LISTEN_TIMEOUT } from './common';
import { createSocket, Socket, RemoteInfo } from 'dgram';
import { ReadContext } from './utils/ReadContext';

export interface ConnectionInfo extends DiscoveryMessage {
	address: string;
}

export type DeviceDetectedCallback = (deviceIndex: number, connectionInfo: ConnectionInfo) => void;
export type DeviceLostCallback = (deviceIndex: number) => void;

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

type TimeStamp = number;

function getTimeStamp(): TimeStamp {
	return Date.now();
}

type DeviceList = {
	[key: string]: {
		time: TimeStamp;
		id: number;
	};
};

export class Listener {
	private detected: DeviceDetectedCallback = null;
	private lost: DeviceLostCallback = null;
	private listenTimeout: number = null;
	private listenTimer: NodeJS.Timeout = null;
	private cleanupTimer: NodeJS.Timeout = null;
	private socket: Socket = null;
	private foundDevices: DeviceList = {};

	constructor(
		p_detected: DeviceDetectedCallback,
		p_lost: DeviceLostCallback,
		p_cleanupInterval: number,
		p_listenTimeout: number = LISTEN_TIMEOUT
	) {
		this.detected = p_detected;
		this.lost = p_lost;
		this.listenTimeout = p_listenTimeout;

		if (this.socket) {
			console.error('Already listening');
			return;
		}

		// This timer times out when there is not a single controller detected within a certain timeframe
		this.cleanupTimer = setInterval(() => {
			this.cleanup();
		}, p_cleanupInterval);

		// This timer times out when there is not a single controller detected within a certain timeframe
		this.listenTimer = setTimeout(() => {
			this.release();
			throw new Error('Failed to detect any controller');
		}, this.listenTimeout);

		this.socket = createSocket('udp4');
		let idx = 0;
		this.socket.on('message', (p_announcement: Uint8Array, p_remote: RemoteInfo) => {
			const ctx = new ReadContext(p_announcement.buffer, false);
			const result = readConnectionInfo(ctx, p_remote.address);
			assert(ctx.tell() === p_remote.size);
			if (result === null || result.software.name === 'OfflineAnalyzer' || result.source === 'testing') {
				return;
			}

			// We actually found a device, no need to timeout anymore
			clearTimeout(this.listenTimer);
			this.listenTimer = null;

			assert(result.action === Action.Login);
			const id = `${JSON.stringify(result.token)}`;

			const timeStamp = getTimeStamp();
			if (this.foundDevices.hasOwnProperty(id)) {
				this.foundDevices[id].time = timeStamp;
			} else {
				this.foundDevices[id] = {
					time: timeStamp,
					id: idx++,
				};
				this.detected(this.foundDevices[id].id, result);
			}
		});

		this.socket.bind(LISTEN_PORT);
	}

	release() {
		assert(this.socket);
		this.socket.close;
		this.socket = null;
		clearTimeout(this.listenTimer);
		this.listenTimer = null;
		clearTimeout(this.cleanupTimer);
		this.cleanupTimer = null;
	}

	private cleanup() {
		const cleaned: DeviceList = {};
		const now = getTimeStamp();
		for (const [key, elem] of Object.entries(this.foundDevices)) {
			if (now - elem.time < this.listenTimeout) {
				cleaned[key] = elem;
			} else {
				this.lost(elem.id);
			}
		}
		this.foundDevices = cleaned;
	}
}
