/// <reference types="node" />
import { EventEmitter } from 'events';
import { NetworkDevice } from '../network/NetworkDevice';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import * as tcp from '../utils/tcp';
import type { ServiceMessage } from '../types';
export declare abstract class Service<T> extends EventEmitter {
    private address;
    private port;
    readonly name: string;
    protected controller: NetworkDevice;
    protected connection: tcp.Connection;
    constructor(p_address: string, p_port: number, p_controller: NetworkDevice);
    connect(): Promise<void>;
    disconnect(): void;
    waitForMessage(p_messageId: number): Promise<T>;
    write(p_ctx: WriteContext): Promise<number>;
    writeWithLength(p_ctx: WriteContext): Promise<number>;
    protected init(): Promise<void>;
    protected abstract parseData(p_ctx: ReadContext): ServiceMessage<T>;
    protected abstract messageHandler(p_data: ServiceMessage<T>): void;
}
