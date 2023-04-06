import { DeviceId } from '../devices/DeviceId';

export enum Action {
    Login = 'DISCOVERER_HOWDY_',
    Logout = 'DISCOVERER_EXIT_',
}

export enum MessageId {
    ServicesAnnouncement = 0x0,
    TimeStamp = 0x1,
    ServicesRequest = 0x2,
}

export interface DiscoveryMessage {
    deviceId: DeviceId;
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
    unit?: {
        name: string,
        type: string,
        decks: number
    };
    addressPort?: string;
}

export interface ServiceMessage<T> {
    id: number;
    message: T;
}


// TODO: Maybe some kind of validation?
export type IpAddress = string;
export type IpAddressPort = string;