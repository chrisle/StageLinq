import { strict as assert } from 'assert';
import { ReadContext } from '../utils/ReadContext';
import { WriteContext } from '../utils/WriteContext';
import { Service } from './Service';
import { ServiceInitMessage } from '../network';
import { ServiceMessage, ServicePorts, ConnectionInfo, LISTEN_TIMEOUT, MessageId, Tokens } from '../types';
import { Logger } from '../LogEmitter';
import { sleep } from '../utils/sleep';
import { Socket, AddressInfo } from 'net';



export interface DirectoryData {
  deviceId: string;
  servicePorts: ServicePorts;

}

export class Directory extends Service<DirectoryData> {
  public timeAlive: number;
  public servicePorts: ServicePorts;
  public serviceRequestAllowed: boolean = false;
  public services: Map<string, number>;

  constructor(p_initMsg:ServiceInitMessage) {
		super(p_initMsg);
		this.services = p_initMsg.services;
	}
  
  async init() {
    
  }

  protected parseData(ctx: ReadContext, socket: Socket): ServiceMessage<DirectoryData> {
    
    let deviceId: string = "";
    let servicePorts: ServicePorts = {};
    //let token: string = null;
    while (ctx.isEOF() === false) {
      const id = ctx.readUInt32();
      const tokenArray = ctx.read(16);
      deviceId = /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
        .exec(Buffer.from(tokenArray).toString('hex')).splice(1).join('-');
      //if (!token){
      //  token = ctx.read(16).toString();
        this.connections.set(deviceId, socket)
      //} else {
      //  ctx.seek(16);
      //}
      //ctx.seek(16);
      //console.log(MessageId[id])
      switch (id) {
        case MessageId.TimeStamp:
          ctx.seek(16);
          // const secondToken = ctx.read(16); // should be 00..
          // we _shouldn't_ be receiving anything but blank tokens in the 2nd field
          // assert(secondToken.every((x) => x === 0));

          // Time Alive is in nanoseconds; convert back to seconds
          this.timeAlive = Number(ctx.readUInt64() / (1000n * 1000n * 1000n));
          // this.sendTimeStampMsg(deviceToken, Tokens.SoundSwitch);
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
          console.log(deviceId,id,serviceRequest);
          //this.sendServiceRequest(socket);
          this.sendServiceAnnouncement(socket);
          //this.sendServiceRequest(socket);
          

          //this.serviceRequestAllowed = true;
          //try {
          //  this.requestAllServicePorts(socket);
          //} catch (err) {
          //  console.error(err)
         // }
          
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
    //const ctx = new ReadContext(p_message.buffer, false);
    //console.log(directoryMsg.message);
  }

  
  //socket.write(wtx3.getBuffer());

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
      //console.warn(value);
      ctx.writeUInt32(MessageId.ServicesAnnouncement);
      ctx.write(Tokens.Listen);
      ctx.writeNetworkStringUTF16(value[0]);
      ctx.writeUInt16(value[1]);
    }
   
    await socket.write(ctx.getBuffer());
    console.log(`sent ServiceAnnouncement to ${socket.remoteAddress}:${socket.remotePort}`)
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

}


