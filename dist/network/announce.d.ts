/**
 * Network Announcement Module
 *
 * Handles UDP broadcast announcements for StageLinq device discovery.
 * Includes platform-specific handling for Windows broadcast requirements.
 *
 * Windows broadcast fix ported from go-stagelinq (icedream)
 * https://github.com/icedream/go-stagelinq
 */
import type { DiscoveryMessage } from '../types';
/**
 * Stop announcing and send logout message
 */
export declare function unannounce(message: DiscoveryMessage): Promise<void>;
/**
 * Start announcing presence on the StageLinq network
 */
export declare function announce(message: DiscoveryMessage): Promise<void>;
export interface DiscoveryMessageOptions {
    name: string;
    version: string;
    source: string;
    token: Uint8Array;
}
export declare function createDiscoveryMessage(action: string, discoveryMessageOptions: DiscoveryMessageOptions): DiscoveryMessage;
