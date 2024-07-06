import { ReadContext } from '../utils/ReadContext';
import { Service } from './Service';
import type { ServiceMessage, Source } from '../types';
export declare const CHUNK_SIZE = 4096;
declare type FileTransferData = any;
interface FileTransferProgress {
    sizeLeft: number;
    total: number;
    bytesDownloaded: number;
    percentComplete: number;
}
export declare interface FileTransfer {
    on(event: 'fileTransferProgress', listener: (progress: FileTransferProgress) => void): this;
}
export declare class FileTransfer extends Service<FileTransferData> {
    private receivedFile;
    private _available;
    init(): Promise<void>;
    protected parseData(p_ctx: ReadContext): ServiceMessage<FileTransferData>;
    protected messageHandler(p_data: ServiceMessage<FileTransferData>): void;
    getFile(p_location: string): Promise<Uint8Array>;
    getSources(): Promise<Source[]>;
    private requestStat;
    private requestSources;
    private requestFileTransferId;
    private requestChunkRange;
    private signalTransferComplete;
    waitTillAvailable(): Promise<void>;
}
export {};
