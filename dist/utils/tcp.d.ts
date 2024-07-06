/// <reference types="node" />
import { Socket as TCPSocket } from 'net';
import { PromiseSocket } from 'promise-socket';
export declare type Connection = PromiseSocket<TCPSocket>;
export declare function connect(p_ip: string, p_port: number): Promise<Connection>;
