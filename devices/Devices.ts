import { EventEmitter } from 'events';
import * as Services from '../services';
import { ConnectionInfo } from '../types';
import { DeviceId } from '../devices'
import { sleep } from '../utils';


export declare interface Devices {
  on(event: 'newDevice', listener: (device: Device) => void): this;
  on(event: 'newService', listener: (device: Device, service: InstanceType<typeof Services.Service>) => void): this;
}

export class Devices extends EventEmitter {
  #devices: Map<string, Device> = new Map();

  /**
   * Add Device
   * @param {ConnectionInfo} info 
   * @returns {Device}
   */
  addDevice(info: ConnectionInfo): Device {
    const device = new Device(info, this);
    this.#devices.set(device.deviceId.string, device)
    this.emit('newDevice', device)
    return device
  }

  /**
   * 
   * @param {(string | Uint8Array | DeviceId)} deviceId 
   * @returns {Promise<Device>}
   */
  async getDevice(deviceId: string | Uint8Array | DeviceId): Promise<Device> {
    while (!this.hasDevice(deviceId)) {
      await sleep(150);
    }

    if (typeof deviceId == "string") {
      return this.#devices.get(deviceId)
    }
    if (deviceId instanceof DeviceId) {
      const _deviceId = deviceId as DeviceId
      return this.#devices.get(_deviceId.string)
    }
    if (typeof deviceId == "object") {
      const deviceString = /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
        .exec(Buffer.from(deviceId as Uint8Array).toString('hex'))
        .splice(1)
        .join('-') as string
      return this.#devices.get(deviceString);
    }
  }

  /**
   * 
   * @param {(string | Uint8Array | DeviceId)} deviceId 
   * @returns {Device}
   */
  device(deviceId: string | Uint8Array | DeviceId): Device {
    if (typeof deviceId == "string") {
      return this.#devices.get(deviceId)
    }
    if (deviceId instanceof DeviceId) {
      const _deviceId = deviceId as DeviceId
      return this.#devices.get(_deviceId.string)
    }
    if (typeof deviceId == "object") {
      const deviceString = /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
        .exec(Buffer.from(deviceId as Uint8Array).toString('hex'))
        .splice(1)
        .join('-') as string
      return this.#devices.get(deviceString);
    }
  }

  /**
   * 
   * @param {(string | Uint8Array | DeviceId)} deviceId 
   * @returns {boolean} 
   */
  hasDevice(deviceId: Uint8Array | string | DeviceId): boolean {
    if (typeof deviceId == "string") {
      return this.#devices.has(deviceId)
    }
    if (deviceId instanceof DeviceId) {
      const _deviceId = deviceId as DeviceId
      return this.#devices.has(_deviceId.string)
    }
    if (typeof deviceId == "object") {
      return this.#devices.has(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
        .exec(Buffer.from(deviceId as Uint8Array).toString('hex'))
        .splice(1)
        .join('-') as string)
    }
  }

  /**
  * 
  * @param {(string | Uint8Array | DeviceId)} deviceId 
  * @param {ConnectionInfo} info 
  * @returns {boolean}
  */
  hasNewInfo(deviceId: Uint8Array | string | DeviceId, info: ConnectionInfo): boolean {
    return this.device(deviceId).info?.port !== info.port
  }

  /**
   * 
   * @param {DeviceId} deviceId 
   * @param {ConnectionInfo} info 
   */
  async updateDeviceInfo(deviceId: DeviceId, info: ConnectionInfo): Promise<void> {
    const device = await this.getDevice(deviceId)
    device.info = info;
    await this.#devices.set(deviceId.string, device);
  }

  /**
   * 
   * @param {DeviceId} deviceId 
   * @param {Service} service 
   */
  addService(deviceId: DeviceId, service: InstanceType<typeof Services.Service>) {
    const device = this.device(deviceId.string)
    device.addService(service)
  }

  /**
   * 
   * @param {DeviceId} deviceId 
   * @param {string} serviceName 
   */
  deleteService(deviceId: DeviceId, serviceName: string) {
    const device = this.device(deviceId.string);
    device.deleteService(serviceName)
  }

}

export class Device extends EventEmitter {
  readonly parent: Devices;
  readonly deviceId: DeviceId;
  info: ConnectionInfo;
  private services: Map<string, InstanceType<typeof Services.Service>> = new Map();

  /**
   * @constructor
   * @param {connectionInfo} info 
   * @param {Devices} parent 
   */
  constructor(info: ConnectionInfo, parent: Devices) {
    super();
    this.deviceId = new DeviceId(info.token);
    this.parent = parent;
    this.info = info;
  }

  /**
   * Add an instantiated Service
   * @param {Service} service 
   */
  addService(service: InstanceType<typeof Services.Service>) {
    this.services.set(service.name, service)
  }

  /**
   * Remove a service
   * @param {string} serviceName 
   */
  deleteService(serviceName: string) {
    this.services.delete(serviceName)
  }
}