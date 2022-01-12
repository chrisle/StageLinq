import { strict as assert } from 'assert';
import {
	Action,
	DISCOVERY_MESSAGE_MARKER,
	DISCOVERY_TIMEOUT,
	LOST_TIMEOUT,
	EXCLUDE_DEVICES,
	LISTEN_PORT,
} from './common';
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

type DeviceList = {
	[key: string]: {
		time: TimeStamp;
		id: number;
	};
};

export class Listener {
	private detected: DeviceDetectedCallback = null;
	private lost: DeviceLostCallback = null;
	private socket: Socket = null;
	private foundDevices: DeviceList = {};
	private currentDeviceId = 0;
	private elapsedTime: TimeStamp = 0;
	private cleanupInterval = 1000; // In milliseconds. It's too specific to add to common

	constructor(p_detected: DeviceDetectedCallback, p_lost: DeviceLostCallback) {
		this.detected = p_detected;
		this.lost = p_lost;

		this.socket = createSocket('udp4');
		this.socket.on('message', (p_announcement: Uint8Array, p_remote: RemoteInfo) => {
			const ctx = new ReadContext(p_announcement.buffer, false);
			const result = readConnectionInfo(ctx, p_remote.address);
			assert(ctx.tell() === p_remote.size);
			if (
				result === null ||
				result.software.name === 'OfflineAnalyzer' ||
				EXCLUDE_DEVICES.includes(result.source)
			) {
				return;
			}

			assert(result.action === Action.Login || result.action === Action.Logout);

			// FIXME: find other way to generate unique key for this device
			const key = `${JSON.stringify(result.token)}`;

			if (this.foundDevices.hasOwnProperty(key)) {
				this.foundDevices[key].time = this.elapsedTime;
			} else {
				this.foundDevices[key] = {
					time: this.elapsedTime,
					id: this.currentDeviceId++,
				};
				this.detected(this.foundDevices[key].id, result);
			}
		});

		console.info('Listening for StageLinq devices ...');
		this.socket.bind(LISTEN_PORT);
	}

	release() {
		assert(this.socket);
		this.socket.close;
		this.socket = null;
	}

	public update(p_elapsed: number) {
		const prevTime = this.elapsedTime;
		this.elapsedTime += p_elapsed;

		if (this.elapsedTime > DISCOVERY_TIMEOUT && this.currentDeviceId === 0) {
			throw new Error('Failed to detect any controller');
		}

		// Check if a cleanup interval has passed
		{
			const cleanupsBefore = Math.floor(prevTime / this.cleanupInterval);
			const cleanupsAfter = Math.floor(this.elapsedTime / this.cleanupInterval);
			if (cleanupsAfter !== cleanupsBefore) {
				this.cleanup();
			}
		}
	}

	private cleanup() {
		const cleaned: DeviceList = {};
		for (const [key, elem] of Object.entries(this.foundDevices)) {
			if (this.elapsedTime - elem.time < LOST_TIMEOUT) {
				cleaned[key] = elem;
			} else {
				this.lost(elem.id);
			}
		}
		this.foundDevices = cleaned;
	}
}
