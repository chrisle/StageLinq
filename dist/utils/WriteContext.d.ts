/// <reference types="node" />
import { Context } from './Context';
interface WriteContextConstructOptions {
    size?: number;
    autoGrow?: boolean;
    littleEndian?: boolean;
}
export declare class WriteContext extends Context {
    autoGrow: boolean;
    constructor(p_options?: WriteContextConstructOptions);
    getBuffer(): Buffer;
    sizeLeft(): number;
    checkSize(p_size: number): void;
    resize(): void;
    write(p_buffer: Uint8Array, p_bytes?: number): number;
    writeFixedSizedString(p_string: string): number;
    writeNetworkStringUTF16(p_string: string): number;
    writeUInt64(p_value: bigint): number;
    writeUInt32(p_value: number): number;
    writeUInt16(p_value: number): number;
    writeUInt8(p_value: number): number;
}
export {};
