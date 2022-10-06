import { ConnectionInfo } from '../types';
import { createSocket, RemoteInfo } from 'dgram';
import { LISTEN_PORT, DISCOVERY_MESSAGE_MARKER } from '../types/common';
import { ReadContext } from '../utils/ReadContext';
import { strict as assert } from 'assert';

type DeviceDiscoveryCallback = (info: ConnectionInfo) => void;

/**
 * Continuously listens for devices to announce themselves. When they do,
 * execute a callback.
 */
export class StageLinqListener {

  /**
   * Listen for new devices on the network and callback when a new one is found.
   * @param callback Callback when new device is discovered.
   */
  listenForDevices(callback: DeviceDiscoveryCallback) {
    const client = createSocket('udp4');
    client.on('message', (p_announcement: Uint8Array, p_remote: RemoteInfo) => {
      const ctx = new ReadContext(p_announcement.buffer, false);
      const result = this.readConnectionInfo(ctx, p_remote.address);
      assert(ctx.tell() === p_remote.size);
      callback(result);
    });
    client.bind(LISTEN_PORT);
  }

  private readConnectionInfo(p_ctx: ReadContext, p_address: string): ConnectionInfo {
    const magic = p_ctx.getString(4);
    if (magic !== DISCOVERY_MESSAGE_MARKER) {
      return null;
    }

    const result: ConnectionInfo = {
      token: p_ctx.read(16),
      source: p_ctx.readNetworkStringUTF16(),
      action: p_ctx.readNetworkStringUTF16(),
      software: {
        name: p_ctx.readNetworkStringUTF16(),
        version: p_ctx.readNetworkStringUTF16(),
      },
      port: p_ctx.readUInt16(),
      address: p_address,
    };
    result.addressPort = [result.address, result.port].join(":");
    assert(p_ctx.isEOF());
    return result;
  }
}
