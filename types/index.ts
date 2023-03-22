import { Socket } from 'net';
import { DbConnection } from '../Databases';
import { DiscoveryMessageOptions } from '../network';
import * as Services from '../services';
import { DeviceId } from './DeviceId';


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

export enum DeviceType  {
	Player =  "PLAYER",
	Mixer = "MIXER",
	Controller = "CONTROLLER",
}


export interface ConnectionInfo extends DiscoveryMessage {
	address: IpAddress;
	device?: {
		name: string,
		type: string,
		decks: number
	};
	addressPort?: string;
}

// export interface DiscoveryDevice {
//     [key: string]: {
//       info: ConnectionInfo;
      
//   }
// }


export interface ServicePorts {
	[key: string]: number;
}

export interface ServiceMessage<T> {
	id: number;
	message: T;
	socket: Socket;
	deviceId: DeviceId;
}

export interface Source {
	name: string;
	deviceId: DeviceId;
	service: InstanceType<typeof Services.FileTransfer>
	database: {
		location: string;
		size: number;
		connection?: DbConnection; 
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
	BeatInfo = "BeatInfo",
	TimeSynchronization = "TimeSynchronization",
	Directory = "Directory",
}


export interface StageLinqOptions {
	maxRetries?: number;
	actingAs?: DiscoveryMessageOptions;
	downloadDbSources?: boolean;
	services?: ServiceList[];
	//services?: typeof Services[]
}

type deviceType = {
	[key: string] : {
		name: string,
		type: string,
		decks: number,
	}
}

export const deviceTypes:deviceType = {
	JC11: { name: 'PRIME4', type: 'CONTROLLER', decks: 4 },
	JC16: { name: 'PRIME2', type: 'CONTROLLER', decks: 2 },
	JC20: { name: 'LC6000', type: 'OTHER' , decks: 0 },
	JP07: { name: 'SC5000', type: 'PLAYER' , decks: 2 },
	JP08: { name: 'SC5000M', type: 'PLAYER', decks: 2 },
	JP11: { name: 'PRIMEGO', type: 'CONTROLLER', decks: 2 },
	JP13: { name: 'SC6000', type: 'PLAYER', decks: 2 },
	JP14: { name: 'SC6000M', type: 'PLAYER', decks: 2 },
	JP20: { name: 'SCLIVE2', type: 'CONTROLLER', decks: 2 },
	JP21: { name: 'SCLIVE4', type: 'CONTROLLER', decks: 4 },
	NH08: { name: 'MIXSTREAMPRO', type: 'CONTROLLER', decks: 2 },
	NH09: { name: 'MIXSTREAMPROPLUS', type: 'CONTROLLER', decks: 2 },
	NH10: { name: 'MIXSTREAMPROGO', type: 'CONTROLLER', decks: 2 },
	JM08: { name: 'DN-X1800Prime', type: 'MIXER', decks: 0 },
	JM10: { name: 'DN-X1850Prime', type: 'MIXER' , decks: 0 },
	//OfflineAnalyzer: { name: 'OfflineAnalyzer', type: 'OTHER' }
  }
