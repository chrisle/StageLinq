import { EventEmitter } from 'events';
import { Service } from '../services';
import { ConnectionInfo } from '../types';
import { DeviceId } from '../devices'
import { sleep } from '../utils';


export declare interface Devices {
  on(event: 'newDevice', listener: (device: Device) => void): this;
  on(event: 'newService', listener: (device: Device, service: InstanceType<typeof Service>) => void): this;
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
   * @param {DeviceId} deviceId 
   * @returns {Promise<Device>}
   */
  async getDevice(deviceId: DeviceId): Promise<Device> {
    while (!this.hasDevice(deviceId)) {
      await sleep(150);
    }
    return this.#devices.get(deviceId.string)
  }

  /**
   * 
   * @param {DeviceId} deviceId 
   * @returns {Device}
   */
  device(deviceId: DeviceId): Device {
    return this.#devices.get(deviceId.string)
  }

  /**
   * 
   * @param {DeviceId} deviceId 
   * @returns {boolean} 
   */
  hasDevice(deviceId: DeviceId): boolean {
    return this.#devices.has(deviceId.string)
  }

  /**
  * 
  * @param {DeviceId} deviceId 
  * @param {ConnectionInfo} info 
  * @returns {boolean}
  */
  hasNewInfo(deviceId: DeviceId, info: ConnectionInfo): boolean {
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
  addService(deviceId: DeviceId, service: InstanceType<typeof Service>) {
    const device = this.device(deviceId)
    device.addService(service)
  }

  /**
   * 
   * @param {DeviceId} deviceId 
   * @param {string} serviceName 
   */
  deleteService(deviceId: DeviceId, serviceName: string) {
    const device = this.device(deviceId);
    device.deleteService(serviceName)
  }

}

export class Device extends EventEmitter {
  readonly parent: Devices;
  readonly deviceId: DeviceId;
  info: ConnectionInfo;
  private services: Map<string, InstanceType<typeof Service>> = new Map();

  /**
   * @constructor
   * @param {connectionInfo} info 
   * @param {Devices} parent 
   */
  constructor(info: ConnectionInfo, parent: Devices) {
    super();
    this.deviceId = info.deviceId;
    this.parent = parent;
    this.info = info;
  }

  /**
   * Add an instantiated Service
   * @param {Service} service 
   */
  addService(service: InstanceType<typeof Service>) {
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