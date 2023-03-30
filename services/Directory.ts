import { Logger } from '../LogEmitter';
import { ReadContext } from '../utils/ReadContext';
import { Service, ServiceHandler } from './Service';
import { ServiceMessage, MessageId, deviceTypes } from '../types';
import { DeviceId } from '../devices'
import { sleep } from '../utils/sleep';
import { Socket } from 'net';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import { FileTransfer } from './FileTransfer';
import { StateMap } from './StateMap';
import { BeatInfo } from './BeatInfo';
import { TimeSynchronization } from './TimeSync';

export interface DirectoryData {
  deviceId: string;
}

export class DirectoryHandler extends ServiceHandler<DirectoryData> {
  public name: string = "Directory"

  public setupService(service: Service<DirectoryData>) {
    Logger.debug(`Setting up ${service.name}`);
  }
}

export class Directory extends Service<DirectoryData> {
  public readonly name = 'Directory';

  protected readonly isBufferedService = false;
  protected timeAlive: number;

  protected parseServiceData(
    messageId: number,
    deviceId: DeviceId,
    serviceName: string,
    socket: Socket
  ): ServiceMessage<DirectoryData> {
    assert(socket);
    Logger.silly(`${MessageId[messageId]} to ${serviceName} from ${deviceId.string}`);
    return;
  }

  protected parseData(ctx: ReadContext, socket: Socket): ServiceMessage<DirectoryData> {
    
     if (ctx.sizeLeft() < 20) {
      return
    }

    const id = ctx.readUInt32();
    const token = ctx.read(16);
    if (!token) {
      return
    }
    
    this.deviceId = new DeviceId(token);
    const deviceInfo = this.parent.discovery.getConnectionInfo(this.deviceId);

    try {
      switch (id) {
        case MessageId.TimeStamp:
          ctx.seek(16);
          let timeAlive:bigint = 1n
          if (ctx.sizeLeft()>= 8) {
            timeAlive = ctx.readUInt64();
            this.timeAlive = Number(timeAlive / (1000n * 1000n * 1000n));
          } 
          
          if (deviceInfo && deviceInfo.device && deviceInfo.device.type === 'MIXER') {
            this.sendTimeStampReply(token, socket);
          }
          break;
        case MessageId.ServicesAnnouncement:
          const service = ctx.readNetworkStringUTF16();
          const port = ctx.readUInt16();
          Logger.silent(this.name, 'received ', service, port);
          break;
        case MessageId.ServicesRequest:
          this.sendServiceAnnouncement(this.deviceId, socket);
          break;
        default:
          ctx.rewind()
          Logger.silent(`${this.name} possible malformed data: ${ctx.readRemainingAsNewBuffer().toString('hex')}`);
          break;
      }
    } catch (err) {
      ctx.rewind();
      Logger.silent(`${this.name} possible malformed data: ${ctx.readRemainingAsNewBuffer().toString('hex')}`)
    }
    

    const directoryMessage: DirectoryData = {
      deviceId: this.deviceId.string
    };
    const directoryData = {
      id: 69,
      socket: socket,
      deviceId: this.deviceId,
      message: directoryMessage,
    };
    return directoryData;
  }

  protected messageHandler(directoryMsg: ServiceMessage<DirectoryData>): void {
    if (!directoryMsg) {
      Logger.silent(`${this.name} Empty Directory Message`)
    }
  }

  private async sendServiceAnnouncement(deviceId: DeviceId, socket?: Socket): Promise<void> {
    const ctx = new WriteContext();
    ctx.writeUInt32(MessageId.ServicesRequest);
    ctx.write(this.parent.options.actingAs.token);
    let services: InstanceType<typeof Service>[] = []
    const device = await this.parent.devices.getDevice(deviceId.string);
    for (const serviceName of Object.keys(this.parent.services)) {
      if (device && !!deviceTypes[device.info?.software?.name]) {
        switch (serviceName) {
          case 'FileTransfer': {
            const fileTransfer = await this.parent.services[serviceName].startServiceListener(FileTransfer, this.parent, deviceId);
            services.push(fileTransfer);
            break;
          }
          case 'StateMap': {
            const stateMap = await this.parent.services[serviceName].startServiceListener(StateMap, this.parent, deviceId);
            services.push(stateMap);
            break;
          }
          case 'BeatInfo': {
            const beatInfo = await this.parent.services[serviceName].startServiceListener(BeatInfo, this.parent, deviceId);
            services.push(beatInfo);
            break;
          }
          case 'TimeSynchronization': {
            const timeSync = await this.parent.services[serviceName].startServiceListener(TimeSynchronization, this.parent, deviceId);
            services.push(timeSync);
            break;
          }
          default:
            break;
        }
      } 
    }

    for (const service of services) {
      ctx.writeUInt32(MessageId.ServicesAnnouncement);
      ctx.write(this.parent.options.actingAs.token);
      ctx.writeNetworkStringUTF16(service.name);
      ctx.writeUInt16(service.serverInfo.port);
      Logger.silly(`${deviceId.string} Created new ${service.name} on port ${service.serverInfo.port}`);
    }

    const msg = ctx.getBuffer();
    await socket.write(msg);
    Logger.silly(`[${this.name}] sent ServiceAnnouncement to ${socket.remoteAddress}:${socket.remotePort}`);
  }

  private async sendTimeStampReply(token: Uint8Array, socket: Socket) {
    const ctx = new WriteContext();
    ctx.writeUInt32(MessageId.TimeStamp);
    ctx.write(token);
    ctx.write(this.parent.options.actingAs.token);
    ctx.writeUInt64(0n);
    const message = ctx.getBuffer();
    assert(message.length === 44);
    await sleep(1400);
    await socket.write(message);
    Logger.silly(`sent TimeStamp to ${socket.remoteAddress}:${socket.remotePort}`);
  }
}
