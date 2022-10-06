import { strict as assert } from 'assert';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service } from './Service';
import { ServiceInitMessage } from '../network';
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

  constructor(p_initMsg:ServiceInitMessage) {
		super(p_initMsg);
		this.services = p_initMsg.services;
    
	}
  
  async init() {
  }

  protected parseData(ctx: ReadContext, socket: Socket): ServiceMessage<DirectoryData> {
    let deviceId: string = "";
    let servicePorts: ServicePorts = {};
    while (ctx.isEOF() === false) {
      const id = ctx.readUInt32();
      const token = ctx.read(16);
      const deviceId = deviceIdFromBuff(token)
      this.connections.set(deviceId, socket);
      switch (id) {
        case MessageId.TimeStamp:
          ctx.seek(16);
          this.timeAlive = Number(ctx.readUInt64() / (1000n * 1000n * 1000n));
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
    let svc = this.services.entries();
    //console.warn(svc);
    await sleep(250);
    const ctx = new WriteContext();
    ctx.writeUInt32(MessageId.ServicesRequest);
    ctx.write(Tokens.Listen);
    for (let i=0; i<this.services.size;i++) {
      const svcEntry = svc.next();
      const value = svcEntry.value;
      ctx.writeUInt32(MessageId.ServicesAnnouncement);
      ctx.write(Tokens.Listen);
      ctx.writeNetworkStringUTF16(value[0]);
      ctx.writeUInt16(value[1]);
    }
   
    await socket.write(ctx.getBuffer());
    Logger.debug(`[${this.name}] sent ServiceAnnouncement to ${socket.remoteAddress}:${socket.remotePort}`)
  }
  
/*
  private async sendTimeStampReply(socket: Socket): Promise<void> {
    await sleep(250);
    //const ctx = new WriteContext();
    
    
    const wtx3 = new WriteContext();
    wtx3.writeUInt32(MessageId.TimeStamp);
    wtx3.write(Tokens.Listen);
    wtx3.write(new Uint8Array(16));
    wtx3.writeUInt64(BigInt(new Date().getTime()-this.timeConnected));
    
    
    //ctx.writeUInt32(MessageId.ServicesAnnouncement);
    //ctx.write(Tokens.Listen);
    //ctx.writeNetworkStringUTF16('DirectoryService');
    //ctx.writeUInt16(this.serverInfo.port);
   // await socket.write(wtx3.getBuffer());
    //console.log(`sent TimeStamp to ${socket.remoteAddress}:${socket.remotePort}`)
}

  

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


