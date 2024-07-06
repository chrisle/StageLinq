import { ConnectionInfo } from '../types';
declare type DeviceDiscoveryCallback = (info: ConnectionInfo) => void;
/**
 * Continuously listens for devices to announce themselves. When they do,
 * execute a callback.
 */
export declare class StageLinqListener {
    /**
     * Listen for new devices on the network and callback when a new one is found.
     * @param callback Callback when new device is discovered.
     */
    listenForDevices(callback: DeviceDiscoveryCallback): void;
    private readConnectionInfo;
}
export {};
