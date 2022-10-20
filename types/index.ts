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
