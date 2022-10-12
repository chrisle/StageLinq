class InvalidDeviceIdError extends Error {
    constructor(m?: string) {
        super(m || "Error: invalid DeviceId !");

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, InvalidDeviceIdError.prototype);
    }
}

export class DeviceId {
    protected m_str: string;
    protected m_array: Uint8Array;

    constructor(deviceId: string | Uint8Array) {
     
        this.m_str = this.forceString(deviceId);
        this.m_array = this.forceArray(deviceId);
        
        let reg:RegExp = new RegExp("[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}", "i")
        if(!reg.test(this.m_str))
            throw new InvalidDeviceIdError();
    }

    toString() {
        return this.m_str;
    }
    toBuffer() {
        return this.m_array;
    }

    //there must be a less hack way to do this...
    private forceString(deviceId: string | Uint8Array): string {
        switch (typeof deviceId) {
            case ('string'):
                return deviceId as string;
                break;
            case ('object'):
                return /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
            .exec(Buffer.from(deviceId).toString('hex')).splice(1).join('-') as string
                //return toStr(deviceId) as string
                break;        
        }
    }
    
    private forceArray(deviceId: string | Uint8Array): Uint8Array {
        switch (typeof deviceId) {
            case ('object'):
                return deviceId as Uint8Array
                break;
            case ('string'):
                return Buffer.from(deviceId.toString().split("-").join(), 'hex') as Uint8Array
                break;
        }
    }
}

export function deviceIdFromBuff(token: Uint8Array): string {
    return /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
      .exec(Buffer.from(token).toString('hex')).splice(1).join('-');
}

/*
Saving incase this is a better way to type DeviceIds
type OptionalRecord = Record<string, unknown> | undefined

type Uuid<T extends OptionalRecord = undefined> = string & { __uuidBrand: T }

type Product = {
    id: Uuid<Product>
    name: string
}

type ProductId = Product['id']

function uuid<T extends OptionalRecord = undefined>(value: string) {
    return value as Uuid<T>
}

function productId(value: string) {
    return uuid<Product>(value)
}

function funcWithProductIdArg(productId: ProductId) {
    // do something
    return productId
}

//const concreteProductId = productId('123e4567-e89b-12d3-a456-426614174000')

// compiles

//funcWithProductIdArg(concreteProductId)

// Argument of type 'string' is not assignable to parameter of type 'ProductId'.
//  Type 'string' is not assignable to type '{ __uuidBrand: Product; }'.(2345)
//
// * @ts-expect-error Not a ProductId.

//funcWithProductIdArg('123e4567-e89b-12d3-a456-426614174000')

*/