import { Socket } from 'net';
import { DiscoveryMessageOptions } from '../network';


export * from './common';
export * from './player';
export * from './tokens';
export * from './models';
export * from './DeviceId';
export * from './Devices';

export interface DiscoveryMessage {
	token: Uint8Array;
	source: string;
	action: string;
	software: {
		name: string;
		version: string;
	};
	port: number;
}

export interface ConnectionInfo extends DiscoveryMessage {
	address: IpAddress;
	addressPort?: string;
}

export interface ServicePorts {
	[key: string]: number;
}

export interface ServiceMessage<T> {
	id: number;
	message: T;
	socket?: Socket;
}

export interface Source {
	name: string;
	database: {
		location: string;
		size: number;
		remote?: {
			location: string,
			device: string,
		},
		local?: {
			path: string,
		}
	};
}

export interface FileTransferInfo {
	txid: number;
	size: number;
}

// TODO: Maybe some kind of validation?
export type IpAddress = string;
export type IpAddressPort = string;


export enum ServiceList  {
	StateMap =  "StateMap",
	FileTransfer = "FileTransfer",
	Directory = "DirectoryService",
}


export interface StageLinqOptions {
	maxRetries?: number;
	actingAs?: DiscoveryMessageOptions;
	downloadDbSources?: boolean;
	services?: ServiceList[];
}


export const deviceIds = {
	JC11: { name: 'PRIME4', type: 'CONTROLLER' },
	JC16: { name: 'PRIME2', type: 'CONTROLLER' },
	JC20: { name: 'LC6000', type: 'OTHER' },
	JP07: { name: 'SC5000', type: 'PLAYER' },
	JP08: { name: 'SC5000M', type: 'PLAYER' },
	JP11: { name: 'PRIMEGO', type: 'CONTROLLER' },
	JP13: { name: 'SC6000', type: 'PLAYER' },
	JP14: { name: 'SC6000M', type: 'PLAYER' },
	JP20: { name: 'SCLIVE2', type: 'CONTROLLER' },
	JP21: { name: 'SCLIVE4', type: 'CONTROLLER' },
	NH08: { name: 'MIXSTREAMPRO', type: 'CONTROLLER' },
	NH09: { name: 'MIXSTREAMPROPLUS', type: 'CONTROLLER' },
	NH10: { name: 'MIXSTREAMPROGO', type: 'CONTROLLER' },
	JM08: { name: 'DN-X1800Prime', type: 'MIXER' },
	JM10: { name: 'DN-X1850Prime', type: 'MIXER' }
  }
