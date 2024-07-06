/// <reference types="node" />
import { Context } from './Context';
export declare class ReadContext extends Context {
    constructor(p_buffer: ArrayBuffer, p_littleEndian?: boolean);
    read(p_bytes: number): Uint8Array;
    readRemaining(): Uint8Array;
    readRemainingAsNewBuffer(): Buffer;
    getString(p_bytes: number): string;
    readNetworkStringUTF16(): string;
    readUInt64(): bigint;
    readUInt32(): number;
    readInt32(): number;
    readUInt16(): number;
    readUInt8(): number;
}
