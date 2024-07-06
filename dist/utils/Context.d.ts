export declare class Context {
    protected buffer: ArrayBuffer;
    protected pos: number;
    protected readonly littleEndian: boolean;
    constructor(p_buffer: ArrayBuffer, p_littleEndian?: boolean);
    sizeLeft(): number;
    tell(): number;
    seek(p_bytes: number): void;
    set(p_offset: number): void;
    isEOF(): boolean;
    isLittleEndian(): boolean;
    rewind(): void;
}
