import { DbConnection } from '../../Databases';
import { FileTransfer } from '../../services';
import { DeviceId } from '../../devices/DeviceId';


export interface Source {
    name: string;
    deviceId: DeviceId;
    service: FileTransfer;
    database: {
        location: string;
        size: number;
        connection?: DbConnection;
        remote?: {
            location: string,
            device: string,
        },
        local?: {
            path: string,
        }
    };
}