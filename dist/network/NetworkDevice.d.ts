/// <reference types="node" />
import { ConnectionInfo } from '../types';
import * as services from '../services';
export declare class NetworkDevice {
    private connection;
    private serviceRequestAllowed;
    private servicePorts;
    private services;
    private timeAlive;
    private connectedSources;
    private connectionInfo;
    constructor(info: ConnectionInfo);
    private get address();
    private get port();
    connect(): Promise<void>;
    disconnect(): void;
    messageHandler(p_message: Buffer): void;
    getPort(): number;
    getTimeAlive(): number;
    connectToService<T extends InstanceType<typeof services.Service>>(ctor: {
        new (p_address: string, p_port: number, p_controller: NetworkDevice): T;
    }): Promise<T>;
    addSource(p_sourceName: string, p_localDbPath: string, p_localAlbumArtPath: string): Promise<void>;
    dumpAlbumArt(p_sourceName: string): Promise<void>;
    querySource(p_sourceName: string, p_query: string, ...p_params: any[]): any[];
    getAlbumArtPath(p_networkPath: string): string;
    private getSourceAndTrackFromNetworkPath;
    private requestAllServicePorts;
}
