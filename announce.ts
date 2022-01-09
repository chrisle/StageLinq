import { strict as assert } from 'assert';
import {
	Action,
	LISTEN_PORT,
	CONNECT_TIMEOUT,
	CLIENT_TOKEN,
	DISCOVERY_MESSAGE_MARKER,
	ANNOUNCEMENT_INTERVAL,
} from './common';
import { createSocket, Socket as UDPSocket } from 'dgram';
import { subnet } from 'ip';
import { networkInterfaces } from 'os';
import { WriteContext } from './utils/WriteContext';

function findBroadcastIPs(): string[] {
	const interfaces = Object.values(networkInterfaces());
	const ips = [];
	for (const i of interfaces) {
		for (const entry of i) {
			if (entry.family === 'IPv4' && entry.internal === false) {
				const info = subnet(entry.address, entry.netmask);
				ips.push(info.broadcastAddress);
			}
		}
	}
	return ips;
}

const announcementMessage: DiscoveryMessage = {
	action: Action.Login,
	port: 0,
	software: {
		name: "MarByteBeep's StageLinq Handler",
		version: '0.0.1',
	},
	source: 'testing',
	token: CLIENT_TOKEN,
};

let announceClient: UDPSocket = null;
let announceTimer: NodeJS.Timer = null;

function writeDiscoveryMessage(p_ctx: WriteContext, p_message: DiscoveryMessage): number {
	let written = 0;
	written += p_ctx.writeFixedSizedString(DISCOVERY_MESSAGE_MARKER);
	written += p_ctx.write(p_message.token);
	written += p_ctx.writeNetworkStringUTF16(p_message.source);
	written += p_ctx.writeNetworkStringUTF16(p_message.action);
	written += p_ctx.writeNetworkStringUTF16(p_message.software.name);
	written += p_ctx.writeNetworkStringUTF16(p_message.software.version);
	written += p_ctx.writeUInt16(p_message.port);
	return written;
}

async function initUdpSocket(): Promise<UDPSocket> {
	return new Promise<UDPSocket>((resolve, reject) => {
		try {
			const client = createSocket('udp4');
			client.bind(); // we need to bind to a random port in order to enable broadcasting
			client.on('listening', () => {
				client.setBroadcast(true); // needs to be true in order to UDP multicast on MacOS
				resolve(client);
			});
		} catch (err) {
			console.error(`Failed to create UDP socket for announcing: ${err}`);
			reject(err);
		}
	});
}

async function broadcastMessage(p_message: Uint8Array): Promise<void> {
	const ips = findBroadcastIPs();
	assert(ips.length > 0, 'No broadcast IPs have been found');

	const send = async function (p_ip: string): Promise<void> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				reject(new Error('Failed to send announcement'));
			}, CONNECT_TIMEOUT);

			announceClient.send(p_message, LISTEN_PORT, p_ip, () => {
				//console.log('UDP message sent to ' + p_ip);
				resolve();
			});
		});
	};

	const promises = ips.map((ip) => send(ip));
	await Promise.all(promises);
}

export async function unannounce(): Promise<void> {
	assert(announceTimer);
	clearInterval(announceTimer);
	announceTimer = null;

	announcementMessage.action = Action.Logout;
	const ctx = new WriteContext();
	writeDiscoveryMessage(ctx, announcementMessage);
	const msg = new Uint8Array(ctx.getBuffer());
	await broadcastMessage(msg);
	//console.info("Unannounced myself");
}

export async function announce(): Promise<void> {
	if (announceTimer) {
		return;
	}

	if (!announceClient) announceClient = await initUdpSocket();

	announcementMessage.action = Action.Login;
	const ctx = new WriteContext();
	writeDiscoveryMessage(ctx, announcementMessage);
	const msg = new Uint8Array(ctx.getBuffer());

	// Immediately announce myself
	await broadcastMessage(msg);

	announceTimer = setInterval(broadcastMessage, ANNOUNCEMENT_INTERVAL, msg);
	//console.info("Announced myself");
}
