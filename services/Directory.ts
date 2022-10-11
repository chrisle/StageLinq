import { strict as assert } from 'assert';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service } from './Service';
import { ServiceMessage, ServicePorts, MessageId, Tokens, DeviceId } from '../types';
import { Logger } from '../LogEmitter';
import { sleep } from '../utils/sleep';
import { Socket } from 'net';

export interface DirectoryData {
  deviceId: string;
  servicePorts: ServicePorts;
}

export class Directory extends Service<DirectoryData> {
  public name: string = "Directory";
  public timeAlive: number;
  public servicePorts: ServicePorts;
  //public serviceRequestAllowed: boolean = false;
  //public services: Map<string, number>;
  protected isBufferedService = false;
  
  async init() {
  }

  protected parseServiceData(messageId: number, deviceId: DeviceId, serviceName: string, socket: Socket): ServiceMessage<DirectoryData> {
    assert((socket));
    Logger.debug(`${MessageId[messageId]} to ${serviceName} from ${deviceId.toString()}`)
    return
  }

  protected parseData(ctx: ReadContext, socket: Socket): ServiceMessage<DirectoryData> {
    let deviceId: string = "";
    let servicePorts: ServicePorts = {};
    while (ctx.isEOF() === false) {
      const id = ctx.readUInt32();
      const token = ctx.read(16);
      const deviceId = new DeviceId(token);
      const ipAddressPort = [socket.remoteAddress, socket.remotePort].join(":");
      const peer = this.parent.peers.get(deviceId.toString())  
      
      this.peerDeviceIds[ipAddressPort] = deviceId;
      this.peerSockets.set(deviceId, socket);

      switch (id) {
        case MessageId.TimeStamp:
          ctx.seek(16);
          const timeAlive = ctx.readUInt64();
          this.timeAlive = Number(timeAlive / (1000n * 1000n * 1000n));
          if (ctx.isEOF() === false ){
            ctx.readRemaining();
          }
          if (peer.software.name === 'JM08') {
            //Logger.debug(peer.software, timeAlive, this.timeAlive, ctx.sizeLeft());
            //sleep(1000)
            this.sendTimeStampReply(token,socket);
          }
          
          break;
        case MessageId.ServicesAnnouncement:
          const service = ctx.readNetworkStringUTF16();
          const port = ctx.readUInt16();
          console.warn('received ',service,port)
          servicePorts[service] = port;
          this.servicePorts[service] = port;
          break;
        case MessageId.ServicesRequest:
          ctx.readRemaining(); //
          this.sendServiceAnnouncement(socket);
          break;
        default:
          assert.fail(`NetworkDevice Unhandled message id '${id}'`);
      }
    }
    const directoryMessage: DirectoryData = {
      deviceId: deviceId,
      servicePorts: servicePorts,
    }
    const directoryData = {
      id: 69,
      message: directoryMessage
    }
    return directoryData
  }

  protected messageHandler(directoryMsg: ServiceMessage<DirectoryData>): void {
    assert(directoryMsg);
  }

  private async sendServiceAnnouncement(socket?: Socket): Promise<void> {
   // await sleep(250);
    const ctx = new WriteContext();
    
    ctx.writeUInt32(MessageId.ServicesRequest);
    ctx.write(Tokens.Listen);
    
    for (const [key, value] of this.parent._services) {
      ctx.writeUInt32(MessageId.ServicesAnnouncement);
      ctx.write(Tokens.Listen);
      ctx.writeNetworkStringUTF16(key);
      ctx.writeUInt16(value.serverInfo.port);
    }
    const msg = ctx.getBuffer();

    await socket.write(msg);
    Logger.debug(`[${this.name}] sent ServiceAnnouncement to ${socket.remoteAddress}:${socket.remotePort}`)
  }
  
  private async sendTimeStampReply(token: Uint8Array ,socket: Socket) {
   
    const ctx = new WriteContext();
    ctx.writeUInt32(MessageId.TimeStamp);
    ctx.write(token);
    ctx.write(Tokens.Listen);
    //ctx.writeUInt64(BigInt(this.timeAlive*10000));
    ctx.writeUInt64(0n);
    const message = ctx.getBuffer();
    assert(message.length === 44);
    await sleep(1400);
    await socket.write(message);
    Logger.debug(`sent TimeStamp to ${socket.remoteAddress}:${socket.remotePort}`)
  } 
}