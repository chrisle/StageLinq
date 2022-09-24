import { DiscoveryMessageOptions } from '../network';

export * from './common';
export * from './player';
export * from './tokens';
export * from './models';

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

export interface ServicePorts {
	[key: string]: number;
}

export interface ServiceMessage<T> {
	id: number;
	message: T;
}

export interface Source {
	name: string;
	database: {
		location: string;
		size: number;
	};
}

export interface FileTransferInfo {
	txid: number;
	size: number;
}

// TODO: Maybe some kind of validation?
export type IpAddress = string;

export interface ConnectionInfo extends DiscoveryMessage {
	address: IpAddress;
}


export interface StageLinqOptions {
	maxRetries?: number;
	actingAs?: DiscoveryMessageOptions;
	downloadDbSources?: boolean;
}