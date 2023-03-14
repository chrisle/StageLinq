import { Logger } from '../LogEmitter';
import { ReadContext } from '../utils/ReadContext';
import { Service } from './Service';
import { ServiceMessage, ServicePorts, MessageId, Tokens, DeviceId } from '../types';
import { sleep } from '../utils/sleep';
import { Socket } from 'net';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import { FileTransfer } from './FileTransfer';
import { StateMap } from './StateMap';
import { BeatInfo } from './BeatInfo';

export interface DirectoryData {
  deviceId: string;
  servicePorts: ServicePorts;
}

export class Directory extends Service<DirectoryData> {
  public name: string = 'Directory';
  public timeAlive: number;
  public servicePorts: ServicePorts;

  protected readonly isBufferedService = false;

  async init() {}

  protected parseServiceData(
    messageId: number,
    deviceId: DeviceId,
    serviceName: string,
    socket: Socket
  ): ServiceMessage<DirectoryData> {
    assert(socket);
    Logger.silly(`${MessageId[messageId]} to ${serviceName} from ${deviceId.toString()}`);
    return;
  }

  protected parseData(ctx: ReadContext, socket: Socket): ServiceMessage<DirectoryData> {
    let deviceId: string = '';
    let servicePorts: ServicePorts = {};
    while (ctx.isEOF() === false) {
      const id = ctx.readUInt32();
      const token = ctx.read(16);
      this.deviceId = new DeviceId(token);
      //const ipAddressPort = [socket.remoteAddress, socket.remotePort].join(':');
      const peer = this.parent.discovery.getConnectionInfo(this.deviceId);

      //this.peerDeviceIds[ipAddressPort] = deviceId;
      //this.peerSockets.set(deviceId, socket);

      switch (id) {
        case MessageId.TimeStamp:
          ctx.seek(16);
          const timeAlive = ctx.readUInt64();
          this.timeAlive = Number(timeAlive / (1000n * 1000n * 1000n));
          if (ctx.isEOF() === false) {
            ctx.readRemaining();
          }
          if (peer && peer.software.name === 'JM08') {
            this.sendTimeStampReply(token, socket);
          }

          break;
        case MessageId.ServicesAnnouncement:
          const service = ctx.readNetworkStringUTF16();
          const port = ctx.readUInt16();
          console.warn('received ', service, port);
          servicePorts[service] = port;
          this.servicePorts[service] = port;
          break;
        case MessageId.ServicesRequest:
          ctx.readRemaining(); //
          this.sendServiceAnnouncement(this.deviceId, socket);
          break;
        default:
          assert.fail(`NetworkDevice Unhandled message id '${id}'`);
      }
    }
    const directoryMessage: DirectoryData = {
      deviceId: deviceId,
      servicePorts: servicePorts,
    };
    const directoryData = {
      id: 69,
      message: directoryMessage,
    };
    return directoryData;
  }

  protected messageHandler(directoryMsg: ServiceMessage<DirectoryData>): void {
    assert(directoryMsg);
  }

  private async sendServiceAnnouncement(deviceId: DeviceId, socket?: Socket): Promise<void> {
    
    const ctx = new WriteContext();

    ctx.writeUInt32(MessageId.ServicesRequest);
    ctx.write(Tokens.Listen);

    let services: InstanceType<typeof Service>[] = []

    for (const serviceName of this.parent.serviceList) {
      switch (serviceName) {
        case 'FileTransfer': {
          const fileTransfer = await this.parent.startServiceListener(FileTransfer, deviceId);
          services.push(fileTransfer);
          break;
        }
        case 'StateMap': {
          const stateMap = await this.parent.startServiceListener(StateMap, deviceId);
          services.push(stateMap);
          break;
        }
        case 'BeatInfo': {
          const beatInfo = await this.parent.startServiceListener(BeatInfo, deviceId);
          services.push(beatInfo);
          break;
        }
        default:
          break;
      }
    }

    this.parent.services[deviceId.toString()] = new Map();
    this.parent.sockets[deviceId.toString()] = new Map();
    //this.parent.devices.

    for (const service of services) {
      
      this.parent.services[deviceId.toString()].set(service.name, service);
      //this.parent.devices.setService(deviceId, service.name, service);

      ctx.writeUInt32(MessageId.ServicesAnnouncement);
      ctx.write(Tokens.Listen);
      ctx.writeNetworkStringUTF16(service.name);
      ctx.writeUInt16(service.serverInfo.port);

      Logger.silly(`${deviceId.toString()} Created new ${service.name} on port ${service.serverInfo.port}`);
      
    }

    const msg = ctx.getBuffer();

    await socket.write(msg);
    Logger.silly(`[${this.name}] sent ServiceAnnouncement to ${socket.remoteAddress}:${socket.remotePort}`);
    
  }

  private async sendTimeStampReply(token: Uint8Array, socket: Socket) {
    const ctx = new WriteContext();
    ctx.writeUInt32(MessageId.TimeStamp);
    ctx.write(token);
    ctx.write(Tokens.Listen);
    ctx.writeUInt64(0n);
    const message = ctx.getBuffer();
    assert(message.length === 44);
    await sleep(1400);
    await socket.write(message);
    Logger.silly(`sent TimeStamp to ${socket.remoteAddress}:${socket.remotePort}`);
  }
}
