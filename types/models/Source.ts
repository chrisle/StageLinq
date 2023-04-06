import { DbConnection } from '../../Sources';
import { FileTransfer } from '../../services';
import { DeviceId } from '../../devices/DeviceId';


export interface Source {
    name: string;
    deviceId: DeviceId;
    service: FileTransfer;
    database: {
        size: number;
        remote: {
            location: string,
            device: DeviceId,
        },
        local?: {
            path: string,
            connection: DbConnection;
        }
    };
}