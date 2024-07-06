/// <reference types="node" />
import { ConnectionInfo, Source } from '../types';
import { EventEmitter } from 'stream';
import { FileTransfer } from '../services';
import { NetworkDevice } from '../network';
export declare interface Databases {
    on(event: 'dbDownloaded', listener: (sourceName: string, dbPath: string) => void): this;
    on(event: 'dbDownloading', listener: (sourceName: string, dbPath: string) => void): this;
    on(event: 'dbProgress', listener: (sourceName: string, total: number, bytesDownloaded: number, percentComplete: number) => void): this;
}
export declare class Databases extends EventEmitter {
    sources: Map<string, string>;
    constructor();
    downloadSourcesFromDevice(connectionInfo: ConnectionInfo, networkDevice: NetworkDevice): Promise<string[]>;
    /**
     * Download databases from this network source.
     */
    downloadDb(sourceId: string, service: FileTransfer, source: Source): Promise<void>;
    getDbPath(dbSourceName?: string): string;
}
