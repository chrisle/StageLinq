import { strict as assert } from 'assert';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service } from './Service';
//import { ServiceInitMessage } from '../network';
import { ServiceInitMessage, StageLinqDevices } from '../network';
import { ServiceMessage, ServicePorts, ConnectionInfo, LISTEN_TIMEOUT, MessageId, Tokens, deviceIdFromBuff } from '../types';
import { Logger } from '../LogEmitter';
import { sleep } from '../utils/sleep';
import { Socket, AddressInfo } from 'net';



export interface DirectoryData {
  deviceId: string;
  servicePorts: ServicePorts;

}

export class Directory extends Service<DirectoryData> {
  public name: string = "Directory";
  public timeAlive: number;
  public servicePorts: ServicePorts;
  public serviceRequestAllowed: boolean = false;
  public services: Map<string, number>;
  protected preparseData = false;

  constructor(p_parent:InstanceType<typeof StageLinqDevices>) {
		super(p_parent);
		//this.services = p_initMsg.services;
    //this.parent.directoryPort =
	}
  
  async init() {
  }

  protected parseServiceData(p_ctx: ReadContext, socket?: Socket, msgId?: number,isSub?:boolean): ServiceMessage<DirectoryData> {
    return
  }

  protected parseData(ctx: ReadContext, socket: Socket, msgId:number, svcMsg:boolean): ServiceMessage<DirectoryData> {
    let deviceId: string = "";
    let servicePorts: ServicePorts = {};
    while (ctx.isEOF() === false) {
      const id = ctx.readUInt32();
      const token = ctx.read(16);
      const deviceId = deviceIdFromBuff(token)
      const ipAddressPort = [socket.remoteAddress, socket.remotePort].join(":");
      //if (!this.deviceIps.has(ipAddressPort) {
        
        this.deviceIps.set(ipAddressPort, deviceId);
      //}
      this.connections.set(deviceId, socket);
      //this.testPoint(ctx, this.getDeviceIdFromSocket(socket), msgId, "switch", false, svcMsg );
      //console.log(msgId, id, deviceId);
      switch (id) {
        case MessageId.TimeStamp:
          ctx.seek(16);
          this.timeAlive = Number(ctx.readUInt64() / (1000n * 1000n * 1000n));
          if (ctx.isEOF() === false ){
            //console.log(ctx.readRemainingAsNewBuffer().toString('hex'));
            ctx.readRemaining();
          }
          this.sendTimeStampReply(token,socket);
          break;
        case MessageId.ServicesAnnouncement:
          const service = ctx.readNetworkStringUTF16();
          const port = ctx.readUInt16();
          console.log('received ',service,port)
          servicePorts[service] = port;
          this.servicePorts[service] = port;
          break;
        case MessageId.ServicesRequest:
          const serviceRequest = ctx.readRemaining();
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
  }

  private async sendServiceAnnouncement(socket?: Socket): Promise<void> {
    //let svc = this.parent._services.entries();
    //console.warn(svc);
    await sleep(250);
    const directoryPort = this.serverInfo.port
    const ctx = new WriteContext();
    
    ctx.writeUInt32(MessageId.ServicesRequest);
    ctx.write(Tokens.Listen);
    //for (let i=0; i<this.parent._services.size;i++) {
    
    for (const [key, value] of this.parent._services) {
     // console.log(key, value);
  
      //const svcEntry = svc.next();
      //const value = svcEntry.value;
      ctx.writeUInt32(MessageId.ServicesAnnouncement);
      ctx.write(Tokens.Listen);
      ctx.writeNetworkStringUTF16(key);
      ctx.writeUInt16(value.serverInfo.port);
      //ctx.writeUInt16(directoryPort);
    }
    const msg = ctx.getBuffer();
    //console.log(msg.toString('ascii'));
    //console.log(msg.toString('hex'));
    await socket.write(msg);
    Logger.debug(`[${this.name}] sent ServiceAnnouncement to ${socket.remoteAddress}:${socket.remotePort}`)
  }
  

  private async sendTimeStampReply(token: Uint8Array ,socket: Socket) {
    //await sleep(250);
    //const ctx = new WriteContext();
    
    
    const wtx3 = new WriteContext();
    wtx3.writeUInt32(MessageId.TimeStamp);
    wtx3.write(token);
    wtx3.write(Tokens.Listen);
    wtx3.writeUInt64(0n);
    
    const message = wtx3.getBuffer();
    assert(message.length === 44);
    //wtx3.writeUInt64(BigInt(new Date().getTime()-this.timeConnected));
    
    
    //ctx.writeUInt32(MessageId.ServicesAnnouncement);
    //ctx.write(Tokens.Listen);
    //ctx.writeNetworkStringUTF16('DirectoryService');
    //ctx.writeUInt16(this.serverInfo.port);
    await socket.write(message);
    //console.log(`sent TimeStamp to ${socket.remoteAddress}:${socket.remotePort}`)
}

  /*

  private async sendServiceRequest(socket?: Socket): Promise<void> {
      await sleep(1500);
      const ctx = new WriteContext();
      ctx.writeUInt32(MessageId.ServicesRequest);
      ctx.write(Tokens.Listen);
      await socket.write(ctx.getBuffer());
      console.log(`sent ServiceRequest to ${socket.remoteAddress}:${socket.remotePort}`)
  }

  private async requestAllServicePorts(socket: Socket): Promise<void> {
    //assert(this.connection);

    return new Promise(async (resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`Failed to requestServices for ` ));
      }, LISTEN_TIMEOUT);

      // Wait for serviceRequestAllowed
    
      // FIXME: Refactor into message writer helper class
      const ctx = new WriteContext();
      ctx.writeUInt32(MessageId.ServicesRequest);
      ctx.write(Tokens.Listen);
      const written = await socket.write(ctx.getBuffer());
      //assert(written === ctx.tell());

      while (true) {
        // FIXME: How to determine when all services have been announced?
        if (Object.keys(this.servicePorts).length > 3) {
          Logger.debug(`Discovered the following services on `);
          for (const [name, port] of Object.entries(this.servicePorts)) {
            Logger.debug(`\tport: ${port} => ${name}`);
          }
          resolve();
          break;
        }
        await sleep(250);
      }
    });
  }
  */
}


