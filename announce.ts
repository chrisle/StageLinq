import { strict as assert } from 'assert';
import { Action, LISTEN_PORT, CONNECT_TIMEOUT, CLIENT_TOKEN, DISCOVERY_MESSAGE_MARKER, ANNOUNCEMENT_INTERVAL } from './common';
import { createSocket, Socket as UDPSocket } from 'dgram';
import { subnet } from 'ip';
import { networkInterfaces } from 'os';
import { WriteContext } from './utils/WriteContext';

function findBroadcastIP(): string {
	const interfaces = Object.values(networkInterfaces());
	for (const i of interfaces) {
		for (const entry of i) {
			if (entry.family === 'IPv4' && entry.internal === false) {
				const info = subnet(entry.address, entry.netmask);
				return info.broadcastAddress;
			}
		}
	}
	return null;
}

const announcementMessage: DiscoveryMessage = {
	action: Action.Login,
	port: 0,
	software: {
		name: "MarByteBeep's StageLinq Handler",
		version: "0.0.1"
	},
	source: "testing",
	token: CLIENT_TOKEN
}

const announceClient: UDPSocket = createSocket('udp4');
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

async function broadcastMessage(p_message: Uint8Array): Promise<void> {
	const bip = findBroadcastIP();

	return await new Promise((resolve, reject) => {
		announceClient.send(p_message, LISTEN_PORT, bip, () => {
			//console.log('UDP message sent to ' + bip);
			resolve();
		});

		setTimeout(() => {
			reject(new Error("Failed to send announcement"));
		}, CONNECT_TIMEOUT);
	});
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

	announcementMessage.action = Action.Login;
	const ctx = new WriteContext();
	writeDiscoveryMessage(ctx, announcementMessage);
	const msg = new Uint8Array(ctx.getBuffer());

	// Immediately announce myself
	await broadcastMessage(msg);

	announceTimer = setInterval(broadcastMessage, ANNOUNCEMENT_INTERVAL, msg);
	//console.info("Announced myself");
}
