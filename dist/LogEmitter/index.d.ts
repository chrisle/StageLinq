/// <reference types="node" />
import { EventEmitter } from 'stream';
export declare interface Logger {
    on(event: 'log', listener: (...args: any) => void): this;
    on(event: 'error', listener: (...args: any) => void): this;
    on(event: 'warn', listener: (...args: any) => void): this;
    on(event: 'info', listener: (...args: any) => void): this;
    on(event: 'debug', listener: (...args: any) => void): this;
    on(event: 'silly', listener: (...args: any) => void): this;
    on(event: 'any', listener: (...args: any) => void): this;
}
export declare class Logger extends EventEmitter {
    private static _instance;
    static get instance(): Logger;
    static log(...args: any): void;
    static error(...args: any): void;
    static warn(...args: any): void;
    static info(...args: any): void;
    static debug(...args: any): void;
    static silly(...args: any): void;
}
