import * as Services from '../services';
//import { Socket } from 'net';
import { ConnectionInfo, DeviceId, IpAddressPort, } from '../types';
//import { Logger } from '../LogEmitter';
import { sleep } from '../utils';



//type DeviceService = Map<string, InstanceType<typeof Services.Service>>;

interface ServicesList {
  [key: string]: InstanceType<typeof Services.Service>;
}

//type DeviceSocket = Map<string, Socket>;

type IpAddressPortDeviceId = Map<IpAddressPort, DeviceId>;

export interface IDevice {
  [key: string]: {
    info: ConnectionInfo;
    services?: ServicesList;
   
  }
}


export class Devices {
  private _devices: IDevice = {};
  public devices: IDevice = {};
  //private devices: Map<DeviceId, Device> = new Map(); 

  getInfo(deviceId: DeviceId) {
    return this._devices[deviceId.toString()].info;
  } 

  setInfo(deviceId: DeviceId, info: ConnectionInfo) {
    if (!this._devices[deviceId.toString()]) {
      this._devices[deviceId.toString()] = {
        info: info
      };
    } else {
      this._devices[deviceId.toString()].info = info;
    }

    // if (!this.devices.has(deviceId)) {
    //   this.devices.set(deviceId, new Device(info))
    // } else {
    //   //this.devices.set()
    // }
    
  } 

  createDevice(deviceId: DeviceId, info: ConnectionInfo) {
    this.devices[deviceId.toString()].info = info;
  } 

  getService(deviceId: DeviceId, serviceName: string) {
    return this._devices[deviceId.toString()].services[serviceName];
  } 

  setService(deviceId: DeviceId, serviceName: string, service: InstanceType<typeof Services.Service>) {
    this._devices[deviceId.toString()].services[serviceName] = service;
  } 

  // getSocket(deviceId: DeviceId, serviceName: string) {
  //   return this._devices[deviceId.toString()].socket.get(serviceName);
  // } 
  
  // setSocket(deviceId: DeviceId, serviceName: string, socket: Socket) {
  //   this._devices[deviceId.toString()].socket.set(serviceName, socket);
  // } 

  hasDeviceId(deviceId: DeviceId) {
    return !!this._devices[deviceId.toString()]
  }

  hasDeviceIdString(deviceIdString: string) {
    return !!this._devices[deviceIdString]
  }

  getDeviceInfoFromString(deviceIdString: string): ConnectionInfo {
    return this._devices[deviceIdString].info
  }

  async getDeviceIdFromIpAddressPort(ipAddressPort: IpAddressPort): Promise<DeviceId> {
    //while (this.devices[key])
    let devices: IpAddressPortDeviceId = new Map();

    while (!devices.has(ipAddressPort)) {
      const keys = Object.keys(this._devices);
      for (const key of keys) {
        if (this._devices[key].info) {
          //Logger.warn(`found ${key}`)
          devices.set(ipAddressPort, new DeviceId(key))
        }
      }
      await sleep(250);
    }
    
    return devices.get(ipAddressPort)

  }

}