import type { DiscoveryMessage } from '../types';
export declare function unannounce(message: DiscoveryMessage): Promise<void>;
export declare function announce(message: DiscoveryMessage): Promise<void>;
export interface DiscoveryMessageOptions {
    name: string;
    version: string;
    source: string;
    token: Uint8Array;
}
export declare function createDiscoveryMessage(action: string, discoveryMessageOptions: DiscoveryMessageOptions): DiscoveryMessage;
