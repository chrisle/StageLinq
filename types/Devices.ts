import * as Services from '../services';
import { Socket } from 'net';
import { ConnectionInfo, DeviceId, IpAddressPort, } from '../types';
//import { Logger } from '../LogEmitter';
import { sleep } from '../utils';

// const deviceTypes = {
  
//     player: [
//       'JP13',
//       'JP14',
//     ],
//     mixer: [
//       'JM08',
//     ],
//     allInOne: [
//       'JP04',
//     ], 
//   }
  
//   function mapTypes() {
//     let devices = new Map();
//     for (let player of deviceTypes.player) {
//       devices.set(player, "player" )
//     }
//     for (let mixer of deviceTypes.mixer) {
//       devices.set(mixer, "mixer" )
//     }
//     for (let allInOne of deviceTypes.allInOne) {
//       devices.set(allInOne, "all-in-one" )
//     }
//     return devices
//   } 


// const deviceTypeMap = mapTypes();
// //console.log(deviceTypeMap.get('JP13'));

// //console.log(deviceTypeMap)

type DeviceService = Map<string, InstanceType<typeof Services.Service>>;

type DeviceSocket = Map<string, Socket>;

type IpAddressPortDeviceId = Map<IpAddressPort, DeviceId>;

export interface IDevice {
  [key: string]: {
    info: ConnectionInfo;
    service?: DeviceService;
    socket?: DeviceSocket;
  }
}


export class Devices {
  private _devices: IDevice = {};
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

  getService(deviceId: DeviceId, serviceName: string) {
    return this._devices[deviceId.toString()].service.get(serviceName);
  } 

  setService(deviceId: DeviceId, serviceName: string, service: InstanceType<typeof Services.Service>) {
    this._devices[deviceId.toString()].service.set(serviceName, service);
  } 

  getSocket(deviceId: DeviceId, serviceName: string) {
    return this._devices[deviceId.toString()].socket.get(serviceName);
  } 
  
  setSocket(deviceId: DeviceId, serviceName: string, socket: Socket) {
    this._devices[deviceId.toString()].socket.set(serviceName, socket);
  } 

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