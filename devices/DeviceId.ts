
class InvalidDeviceIdError extends Error {
  constructor(m?: string) {
    super(m || 'Error: invalid DeviceId !');

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, InvalidDeviceIdError.prototype);
  }
}

export class DeviceId {
  protected m_str: string;
  protected m_array: Uint8Array;

  constructor(deviceId: string);
  constructor(deficeId: Uint8Array);
  constructor(deviceId: any) {
    this.m_str = this.forceString(deviceId);
    this.m_array = this.forceArray(deviceId);

    let reg: RegExp = new RegExp('[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}', 'i');
    if (!reg.test(this.m_str)) throw new InvalidDeviceIdError();
  }

  get string() {
    return this.m_str
  }

  get buffer() {
    return this.m_array
  }

  toString() {
    return this.m_str;
  }

  toBuffer() {
    return this.m_array;
  }

  //there must be a less hack way to do this...
  private forceString(deviceId: string): string;
  private forceString(deviceId: Uint8Array): string;
  private forceString(deviceId: unknown): string {
    if (typeof deviceId === 'string') {
      return deviceId as string;
    }

    if (typeof deviceId === 'object') {
      return /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
        .exec(Buffer.from(deviceId as Uint8Array).toString('hex'))
        .splice(1)
        .join('-') as string;
    }

    throw new Error(`Hell froze over: deviceId is not a string or Uint8Array`);
  }

  private forceArray(deviceId: string | Uint8Array): Uint8Array {
    switch (typeof deviceId) {
      case 'object':
        return deviceId as Uint8Array;
      case 'string':
        return Buffer.from(deviceId.toString().split('-').join(), 'hex') as Uint8Array;
    }
  }
}

export function deviceIdFromBuff(token: Uint8Array): string {
  return /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i.exec(Buffer.from(token).toString('hex')).splice(1).join('-');
}
