import { ConnectionInfo } from '../types';
import { createSocket, RemoteInfo, Socket } from 'dgram';
import { LISTEN_PORT, DISCOVERY_MESSAGE_MARKER } from '../types/common';
import { ReadContext } from '../utils/ReadContext';
import { strict as assert } from 'assert';
import { getConfig } from '../config';

type DeviceDiscoveryCallback = (info: ConnectionInfo) => void;

/**
 * Continuously listens for devices to announce themselves. When they do,
 * execute a callback.
 */
export class StageLinqListener {
  private socket: Socket | null = null;

  /**
   * Listen for new devices on the network and callback when a new one is found.
   * @param callback Callback when new device is discovered.
   */
  listenForDevices(callback: DeviceDiscoveryCallback) {

    const client = createSocket({type: 'udp4', reuseAddr: true});
    this.socket = client;
    client.on('message', (p_announcement: Uint8Array, p_remote: RemoteInfo) => {
      const networkTap = getConfig().networkTap;
      if (networkTap) {
        networkTap({
          direction: 'discovery',
          address: p_remote.address,
          port: p_remote.port,
          data: p_announcement,
        });
      }
      const ctx = new ReadContext(p_announcement.buffer, false);
      const result = this.readConnectionInfo(ctx, p_remote.address);
      assert(ctx.tell() === p_remote.size);
      if (result) callback(result);
    });
    client.bind(LISTEN_PORT);
  }

  /**
   * Stop listening for devices and close the UDP socket.
   */
  stop() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private readConnectionInfo(p_ctx: ReadContext, p_address: string): ConnectionInfo | null {
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
    assert(p_ctx.isEOF());
    return result;
  }
}
