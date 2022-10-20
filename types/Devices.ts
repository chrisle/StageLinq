import * as Services from '../services';
import { Socket } from 'net';
import { ConnectionInfo, DeviceId, IpAddressPort, } from '../types';
import { Logger } from '../LogEmitter';
import { sleep } from '../utils';


type DeviceService = Map<string, InstanceType<typeof Services.Service>>;

type DeviceSocket = Map<string, Socket>;

type IpAddressPortDeviceId = Map<IpAddressPort, DeviceId>;

export interface Device {
  [key: string]: {
    info: ConnectionInfo;
    service?: DeviceService;
    socket?: DeviceSocket;
  }
}

export class Devices {
  private devices: Device = {};

  getInfo(deviceId: DeviceId) {
    return this.devices[deviceId.toString()].info;
  } 

  setInfo(deviceId: DeviceId, info: ConnectionInfo) {
    if (!this.devices[deviceId.toString()]) {
      this.devices[deviceId.toString()] = {
        info: info
      };
    } else {
      this.devices[deviceId.toString()].info = info;
    }
    
  } 

  getService(deviceId: DeviceId, serviceName: string) {
    return this.devices[deviceId.toString()].service.get(serviceName);
  } 

  setService(deviceId: DeviceId, serviceName: string, service: InstanceType<typeof Services.Service>) {
    this.devices[deviceId.toString()].service.set(serviceName, service);
  } 

  getSocket(deviceId: DeviceId, serviceName: string) {
    return this.devices[deviceId.toString()].socket.get(serviceName);
  } 
  
  setSocket(deviceId: DeviceId, serviceName: string, socket: Socket) {
    this.devices[deviceId.toString()].socket.set(serviceName, socket);
  } 

  async hasDeviceId(deviceId: DeviceId) {
   // while (this.devices[deviceId.]
  }

  async getDeviceIdFromIpAddressPort(ipAddressPort: IpAddressPort): Promise<DeviceId> {
    //while (this.devices[key])
    let devices: IpAddressPortDeviceId = new Map();

    while (!devices.has(ipAddressPort)) {
      const keys = Object.keys(this.devices);
      for (const key of keys) {
        if (this.devices[key].info) {
          //Logger.warn(`found ${key}`)
          devices.set(ipAddressPort, new DeviceId(key))
        }
      }
      await sleep(250);
    }
    
    return devices.get(ipAddressPort)

  }

}