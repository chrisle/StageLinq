import { strict as assert } from 'assert';


class InvalidDeviceIdError extends Error {
    constructor(m?: string) {
        super(m || "Error: invalid DeviceId !");

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, InvalidDeviceIdError.prototype);
    }

}
/*
interface deviceId {
    str?: string;
    arr?: Uint8Array
}


type NetworkState =
  | NetworkLoadingState
  | NetworkFailedState
  | NetworkSuccessState
  | NetworkFromCachedState;
 
*/

/*
function getStr(deviceId: string | Uint8Array): string {
    switch (typeof deviceId) {
        case ('string'):
            return deviceId as string;
            break;
        case ('object'):
            return toStr(deviceId) as string
            break;        
    }
}

function getArray(deviceId: string | Uint8Array): Uint8Array {
    switch (typeof deviceId) {
        case ('object'):
            return deviceId as Uint8Array
            break;
        case ('string'):
            return toArr(deviceId) as Uint8Array;
            break;
       
    }
}

function toArr(str: string | Uint8Array): Uint8Array {
    //const u_str = str.toString().split("-").join()//.match(/.{2}/g)
    //let buf = Buffer.from(u_str, 'hex')
    return Buffer.from(str.toString().split("-").join(), 'hex')
}

function toStr(arr:Uint8Array | string): string {
    return /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
        .exec(Buffer.from(arr).toString('hex')).splice(1).join('-');
}
*/

// export 
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
                //return toArr(deviceId) as Uint8Array;
                break;
           
        }
    }
    
    /*
    private toArr(str: string | Uint8Array): Uint8Array {
        //const u_str = str.toString().split("-").join()//.match(/.{2}/g)
        //let buf = Buffer.from(u_str, 'hex')
        return Buffer.from(str.toString().split("-").join(), 'hex')
    }
    
    private toStr(arr:Uint8Array | string): string {
        return /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
            .exec(Buffer.from(arr).toString('hex')).splice(1).join('-');
    }

    
    format(str: string): string {
        assert(str.length === 32);
        
        return /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
        .exec(Buffer.from(str).toString('hex')).splice(1).join('-');
    }
    */

    private static format(str: string): string {
        assert(str.length === 32);
        
        return /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
        .exec(Buffer.from(str).toString('hex')).splice(1).join('-');
    }

    private static newUuid(version?:number) :DeviceId
    {
        version = version || 4;


        // your favourite guid generation function could go here
        // ex: http://stackoverflow.com/a/8809472/188246
        let d = new Date().getTime();
        if (window.performance && typeof window.performance.now === "function") {
            d += performance.now(); //use high-precision timer if available
        }
        let uuid:string = ('xxxxxxxx-xxxx-' + version.toString().substr(0,1) + 'xxx-yxxx-xxxxxxxxxxxx').replace(/[xy]/g, (c) => {
            let r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d/16);
            return (c=='x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

        return new DeviceId(uuid);
    }
}

export function deviceIdFromBuff(token: Uint8Array): string {
    return /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
      .exec(Buffer.from(token).toString('hex')).splice(1).join('-');
}


function getProduct(id: DeviceId) {    
    alert(id); // alerts "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
}


//const guid2 = new UUID();
//console.log(guid2.toString()); // some guid string


//const guid = new UUID("xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx");
//getProduct(guid); // ok
//getProduct("notGuidbutJustString"); // errors, good


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