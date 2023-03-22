import { EventEmitter } from 'events';
import * as Services from '../services';
import { ConnectionInfo, DeviceId } from '../types';


export declare interface Devices {
	on(event: 'newDevice', listener: (device: Device) => void): this;
	on(event: 'newService', listener: (device: Device, service: InstanceType<typeof Services.Service>) => void): this;
  }

export class Devices extends EventEmitter {
  private _devices: Map<string, Device> = new Map();

  getDevices() {
    return [...this._devices.entries()]
  }

  addDevice(info: ConnectionInfo): Device {
    const device = new Device(info, this);
    this._devices.set(device.deviceId.toString(), device)
    this.emit('newDevice', device)
    return device
  }

  device(deviceId: string | Uint8Array | DeviceId): Device {
    if (typeof deviceId == "string") {
      return this._devices.get(deviceId) 
    }
    if (deviceId instanceof DeviceId) {
      const _deviceId = deviceId as DeviceId
      return this._devices.get(_deviceId.toString())
    } 
    if (typeof deviceId == "object") {
      const deviceString = /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
      .exec(Buffer.from(deviceId as Uint8Array).toString('hex'))
      .splice(1)
      .join('-') as string
      return this._devices.get(deviceString);
    }
  }

  
  hasDevice(deviceId: Uint8Array | string | DeviceId) {
    if (typeof deviceId == "string") {
      return this._devices.has(deviceId)
    } 
    if (deviceId instanceof DeviceId) { 
      const _deviceId = deviceId as DeviceId
      return this._devices.has(_deviceId.toString())
    } 
    if  (typeof deviceId == "object"){
      return this._devices.has(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
      .exec(Buffer.from(deviceId as Uint8Array).toString('hex'))
      .splice(1)
      .join('-') as string)
    }
  }

  addService(deviceId: DeviceId, service: InstanceType<typeof Services.Service> ) {
    const device = this.device(deviceId.toString())
    device.addService(service) 
  }

  deleteService(deviceId: DeviceId, serviceName: string) {
    const device = this.device(deviceId.toString());
    device.deleteService(serviceName)
  }

}

export class Device extends EventEmitter {
  readonly parent: Devices;
  readonly deviceId: DeviceId;
  info: ConnectionInfo;
  private services: Map<string, InstanceType<typeof Services.Service>> = new Map();

  constructor(info: ConnectionInfo, parent: Devices) {
    super();
    this.deviceId = new DeviceId(info.token);
    this.parent = parent;
    this.info = info;
  }

  addService(service: InstanceType<typeof Services.Service>) {
    this.services.set(service.name, service)
  }

  deleteService(serviceName: string) {
    this.services.delete(serviceName)
  }

  
}