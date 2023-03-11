import { ConnectionInfo, DiscoveryMessage, Action, IpAddress, DeviceId, deviceIdFromBuff } from '../types';
import { Socket, RemoteInfo } from 'dgram';
import * as UDPSocket from 'dgram';
import { LISTEN_PORT, DISCOVERY_MESSAGE_MARKER, ANNOUNCEMENT_INTERVAL } from '../types/common';
import { ReadContext } from '../utils/ReadContext';
import { strict as assert } from 'assert';
import { sleep, WriteContext } from '../utils';
import { networkInterfaces } from 'os';
import { subnet, SubnetInfo } from 'ip';
//import * as Services from '../services';
import { Logger } from '../LogEmitter';
import { StageLinq } from '../StageLinq';


export interface DiscoveryMessageOptions {
    name: string;
    version: string;
    source: string;
    token: Uint8Array; //FIXME make this DeviceId
    port?: number
};

type DeviceDiscoveryCallback = (info: ConnectionInfo) => void;

/**
 * Continuously listens for devices to announce themselves. When they do,
 * execute a callback.
 */



export class Discovery {
    private socket: Socket;
    private address: IpAddress;
    private broadcastAddress: IpAddress;   
    private options: DiscoveryMessageOptions = null;
    public peers: Map<string, ConnectionInfo> = new Map(); //FIXME figure out getter/setter methods for this?
    public parent: InstanceType<typeof StageLinq>;

    private announceTimer: NodeJS.Timer;
    private hasLooped: boolean = false;
  
    constructor(_parent: InstanceType<typeof StageLinq>) {
        this.parent = _parent;
    }

    async init(options:DiscoveryMessageOptions) {
        this.options = options;
        await this.listenForDevices( (connectionInfo) => {
            
            
            if (!this.parent.devices.hasDeviceIdString(deviceIdFromBuff(connectionInfo.token)) && deviceIdFromBuff(connectionInfo.token) !== deviceIdFromBuff(this.options.token)) {
                const deviceId = new DeviceId(connectionInfo.token)
                this.peers.set(deviceId.toString(), connectionInfo);
                this.parent.devices.setInfo(deviceId, connectionInfo);
                Logger.debug(`Discovery Message From ${connectionInfo.source} ${connectionInfo.software.name} ${deviceId.toString()}`)
            } else {
                this.hasLooped = true;
            }

            if (this.parent.devices.hasDeviceIdString(deviceIdFromBuff(connectionInfo.token)) && this.parent.devices.getDeviceInfoFromString(deviceIdFromBuff(connectionInfo.token)).port !== connectionInfo.port) {
                const deviceId = new DeviceId(connectionInfo.token)
                this.peers.set(deviceId.toString(), connectionInfo);
                this.parent.devices.setInfo(deviceId, connectionInfo);
                Logger.debug(`Updated port for From ${deviceId.toString()}`)
            } 


        });
    }
    

    async announce(port: number) {
        assert(this.socket);
        this.socket.setBroadcast(true);
    
        const discoveryMessage =  this.createDiscoveryMessage(Action.Login, this.options, port);
        
        //  wait for a recieved UDP message to determine the correct interface
        //  no need to rush this as we want the list of peers to be close to complete
        // while (!this.address) {
        //     await sleep(250);
        // }
        while (!this.hasLooped) {
            await sleep(250);
        }

        const ips = this.findBroadcastIPs()
        
        const address = ips.filter(ip => {
            return ip.contains(this.address) === true
        });

        this.broadcastAddress = address.shift().broadcastAddress
        const msg = this.writeDiscoveryMessage(discoveryMessage)
        
        this.broadcastMessage(this.socket, msg, LISTEN_PORT, this.broadcastAddress );
        Logger.debug("Announced myself");
        this.announceTimer = setInterval(this.broadcastMessage, ANNOUNCEMENT_INTERVAL, this.socket, msg, LISTEN_PORT, this.broadcastAddress);
    }


    async unannounce(): Promise<void> {
        assert(this.announceTimer);
        clearInterval(this.announceTimer);
        this.announceTimer = null;
        
        let discoveryMessage = this.createDiscoveryMessage(Action.Logout, this.options);
        const msg = this.writeDiscoveryMessage(discoveryMessage)

        await this.broadcastMessage(this.socket, msg, LISTEN_PORT, this.broadcastAddress);
        await this.socket.close();
        
        Logger.debug("Unannounced myself");
    }
    
    //////////// PRIVATE METHODS ///////////////


    private async broadcastMessage(socket: Socket, msg: Buffer, port: number, address: IpAddress) {  
        socket.send(msg, port, address);
    }


    /**
   * Listen for new devices on the network and callback when a new one is found.
   * @param callback Callback when new device is discovered.
   */
  
    private async listenForDevices(callback: DeviceDiscoveryCallback) {
        this.socket = UDPSocket.createSocket('udp4');
        this.socket.on('message', (p_announcement: Uint8Array, p_remote: RemoteInfo) => {
            const ctx = new ReadContext(p_announcement.buffer, false);
            const result = this.readConnectionInfo(ctx, p_remote.address);
            if (!this.address) {
                this.address = p_remote.address
            }
            assert(ctx.tell() === p_remote.size);
            callback(result);
        });
        this.socket.bind({
            port: LISTEN_PORT,
            exclusive: false,
        });
    }


    private readConnectionInfo(p_ctx: ReadContext, p_address: string): ConnectionInfo {
        const magic = p_ctx.getString(4);
        if (magic !== DISCOVERY_MESSAGE_MARKER) {
            return null;
        }

        const result: ConnectionInfo = {
        token: p_ctx.read(16),
        source: p_ctx.readNetworkStringUTF16(),
        action: p_ctx.readNetworkStringUTF16(),
        software: {
            name: p_ctx.readNetworkStringUTF16(),
            version: p_ctx.readNetworkStringUTF16(),
        },
        port: p_ctx.readUInt16(),
        address: p_address,
        };
        result.addressPort = [result.address, result.port].join(":");
        assert(p_ctx.isEOF());
        return result;
    }

    
    private createDiscoveryMessage(action: string, discoveryMessageOptions: DiscoveryMessageOptions, port?: number): DiscoveryMessage {
        const msg: DiscoveryMessage = {
        action: action,
        port: port || 0,
        software: {
            name: discoveryMessageOptions.name,
            version: discoveryMessageOptions.version
        },
        source: discoveryMessageOptions.source,
        token: discoveryMessageOptions.token //FIXME make this DeviceId
        };
        return msg;
    }


    private writeDiscoveryMessage(p_message: DiscoveryMessage): Buffer {
        const p_ctx = new WriteContext();
        p_ctx.writeFixedSizedString(DISCOVERY_MESSAGE_MARKER);
        p_ctx.write(p_message.token);
        p_ctx.writeNetworkStringUTF16(p_message.source);
        p_ctx.writeNetworkStringUTF16(p_message.action);
        p_ctx.writeNetworkStringUTF16(p_message.software.name);
        p_ctx.writeNetworkStringUTF16(p_message.software.version);
        p_ctx.writeUInt16(p_message.port);
        return p_ctx.getBuffer()
    }


    private findBroadcastIPs(): SubnetInfo[] {
        const interfaces = Object.values(networkInterfaces());
        assert(interfaces.length);
        const ips = [];
        for (const i of interfaces) {
            assert(i && i.length);
            for (const entry of i) {
                if (entry.family === 'IPv4' && entry.internal === false) {
                    const info = subnet(entry.address, entry.netmask);
                    ips.push(info);
                    }
                }
            }
        return ips;
    }
}
