import { ConnectionInfo, IpAddress, PlayerStatus, ServiceMessage, StageLinqOptions } from '../types';
import { EventEmitter } from 'events';
import { NetworkDevice } from '.';
import { Player } from '../devices/Player';
import { sleep } from '../utils';
import { FileTransfer, StateData, StateMap } from '../services';
import { Logger } from '../LogEmitter';
import { Databases } from '../Databases';

enum ConnectionStatus { CONNECTING, CONNECTED, FAILED };

interface StageLinqDevice {
  networkDevice: NetworkDevice;
  fileTransferService: FileTransfer;
};

export declare interface StageLinqDevices {
  on(event: 'trackLoaded', listener: (status: PlayerStatus) => void): this;
  on(event: 'stateChanged', listener: (status: PlayerStatus) => void): this;
  on(event: 'nowPlaying', listener: (status: PlayerStatus) => void): this;
  on(event: 'connected', listener: (connectionInfo: ConnectionInfo) => void): this;
  on(event: 'message', listener: (connectionInfo: ConnectionInfo, message: ServiceMessage<StateData>) => void): this;
  on(event: 'ready', listener: (connectionInfo: ConnectionInfo) => void): this;
}

//////////////////////////////////////////////////////////////////////////////

// TODO: Refactor device, listener, and player into something more nicer.

/**
 * Handle connecting and disconnecting from discovered devices on the
 * StageLinq network.
 */
export class StageLinqDevices extends EventEmitter {

  private _databases: Databases;
  private devices: Map<IpAddress, StageLinqDevice> = new Map();
  private discoveryStatus: Map<string, ConnectionStatus> = new Map();
  private options: StageLinqOptions;

  private deviceWatchTimeout: NodeJS.Timeout | null = null;
  private stateMapCallback: { connectionInfo: ConnectionInfo, networkDevice: NetworkDevice }[] = [];

  constructor(options: StageLinqOptions) {
    super();
    this.options = options;
    this._databases = new Databases();

    // This fucking works!
    // So basically, we check connection status every 3 seconds
    // If everything we found is has connected (meaning it's connected to
    // the device and we've downloaded the database) THEN we setup statemap
    // on all of them.
    this.deviceWatchTimeout = setInterval(() => {
      const values = Array.from(this.discoveryStatus.values());
      Logger.debug(`ARE WE THERE YET?!?!?! ${values}`);
      if (!values.includes(0)) {
        clearInterval(this.deviceWatchTimeout);
        for (const cb of this.stateMapCallback) {
          this.setupStateMap(cb.connectionInfo, cb.networkDevice);
        }
      }
    }, 3000);

  }

  /**
   * Attempt to connect to the player.
   *
   * @param connectionInfo Device discovered
   * @returns Retries to connect 3 times. If successful return void if not throw exception.
   */
  async handleDevice(connectionInfo: ConnectionInfo) {
    Logger.silly(this.showDiscoveryStatus(connectionInfo));

    // Ignore this discovery message if connected, connecting, failed, or
    // if it's blacklisted.
    if (this.isConnected(connectionInfo)
      || this.isConnecting(connectionInfo)
      || this.isFailed(connectionInfo)
      || this.isIgnored(connectionInfo)) return;

    this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.CONNECTING);

    // Retrying appears to be necessary because it seems the Denon hardware
    // sometimes doesn't connect. Retrying after a little wait seems to
    // solve the issue.

    let attempt = 1;

    while (attempt < this.options.maxRetries) {
      try {
        Logger.info(`Connecting to ${this.deviceId(connectionInfo)}. ` +
          `Attempt ${attempt}/${this.options.maxRetries}`);

        // Connect to the player and download the database.
        // If this fails, retry.
        await this.connectToPlayer(connectionInfo);
        this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.CONNECTED);

        // RACE CONDITION!
        // Now that we've connected connect to stateMap and begin handling data.
        // But! We need to wait until all the other players on the network have
        // connected and have databases copied so that if they are looking
        // at tracks from other player, they will have been loaded.
        //
        // Solution!!! see the shitty setInterval in the constructor()
        // FUCK that's ugly. but works.. TODO: Clean up my fucking mess.


        this.emit('ready', connectionInfo);
        return; // Don't forget to return!
      } catch(e) {

        // Failed connection. Sleep then retry.
        Logger.warn(`Could not connect to ${this.deviceId(connectionInfo)} ` +
          `(${attempt}/${this.options.maxRetries}): ${e}`);
        attempt += 1;
        sleep(500);

      }
    }

    // We failed 3 times. Throw exception.
    this.discoveryStatus.set(this.deviceId(connectionInfo), ConnectionStatus.FAILED);
    throw new Error(`Could not connect to ${this.deviceId(connectionInfo)}`);
  }

  /**
   * Disconnect from all connected devices
   */
  disconnectAll() {
    for (const device of this.devices.values()) {
      device.networkDevice.disconnect();
    }
  }

  get databases() {
    return this._databases;
  }

  async downloadFile(deviceId: string, path: string) {
    const device = this.devices.get(deviceId);
    const file = await device.fileTransferService.getFile(path);
    return file;
  }

  ////////////////////////////////////////////////////////////////////////////

  /**
   * Connect to the player.
   * @param connectionInfo Device to connect to.
   * @returns
   */
  private async connectToPlayer(connectionInfo: ConnectionInfo) {
    const networkDevice = new NetworkDevice(connectionInfo);
    await networkDevice.connect();

    const deviceId = this.sourceId(connectionInfo);
    Logger.info(`Successfully connected to ${this.deviceId(connectionInfo)}`);
    const fileTransfer = await networkDevice.connectToService(FileTransfer);

    this.devices.set(`net://${deviceId}`, {
      networkDevice: networkDevice,
      fileTransferService: fileTransfer
    });

    await this.downloadDatabases(connectionInfo, networkDevice);

    this.stateMapCallback.push({ connectionInfo, networkDevice });
    // await this.setupStateMap(connectionInfo, networkDevice);

    this.emit('connected', connectionInfo);
  }

  private sourceId(connectionInfo: ConnectionInfo) {
    return /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/i
      .exec(Buffer.from(connectionInfo.token).toString('hex')).splice(1).join('-');
  }

  private async downloadDatabases(connectionInfo: ConnectionInfo, networkDevice: NetworkDevice) {
    if (this.options.downloadDbSources) {
      const sources = await this.databases.downloadSourcesFromDevice(connectionInfo, networkDevice);
      Logger.debug(`Database sources: ${sources.join(', ')}`);
    }
  }

  private async setupStateMap(connectionInfo: ConnectionInfo, networkDevice: NetworkDevice) {
    Logger.debug('********** SETUP STATEEEEEMAPPPPPPP **********')
    // Setup StateMap
    const stateMap = await networkDevice.connectToService(StateMap);
    stateMap.on('message', (data) => {
      this.emit('message', connectionInfo, data)
    });

    // Setup Player
    const player = new Player({
      stateMap: stateMap,
      address: connectionInfo.address,
      port: connectionInfo.port,
      deviceId: this.sourceId(connectionInfo)
    });

    player.on('trackLoaded', (status) => {
      this.emit('trackLoaded', status);
    });

    player.on('stateChanged', (status) => {
      this.emit('stateChanged', status);
    });

    player.on('nowPlaying', (status) => {
      this.emit('nowPlaying', status);
    });
  }

  private deviceId(device: ConnectionInfo) {
    // NOTE: We're using IP/port combo here instead of something obvious
    // like the device token because the IP/port combo is unique every time
    // the user reboots a device.
    //
    // The side effect is that after it reboots and start broadcasting itself
    // we pick it up as "new" device and attempt to connect to it again. If we
    // used a token it would be the same as last time so the broadcast messages
    // would be ignored.
    return `${device.address}:${device.port}:` +
      `[${device.source}/${device.software.name}]`;
  }

  private isConnecting(device: ConnectionInfo) {
    return this.discoveryStatus.get(this.deviceId(device))
      === ConnectionStatus.CONNECTING;
  }

  private isConnected(device: ConnectionInfo) {
    return this.discoveryStatus.get(this.deviceId(device))
      === ConnectionStatus.CONNECTED;
  }

  private isFailed(device: ConnectionInfo) {
    return this.discoveryStatus.get(this.deviceId(device))
      === ConnectionStatus.FAILED;
  }

  private isIgnored(device: ConnectionInfo) {
    return (
      device.source === this.options.actingAs.source
      || device.software.name === 'OfflineAnalyzer'
      || /^SoundSwitch/i.test(device.software.name)
      || /^Resolume/i.test(device.software.name)
      || device.software.name === 'JM08' // Ignore X1800/X1850 mixers
      || device.software.name === 'SSS0' // Ignore SoundSwitchEmbedded on players
    )
  }

  private isDeviceSeen(device: ConnectionInfo) {
    return this.discoveryStatus.has(device.address);
  }

  private showDiscoveryStatus(device: ConnectionInfo) {
    let msg = `Discovery: ${this.deviceId(device)} `;

    if (!this.isDeviceSeen) return msg += '(NEW)';
    if (this.isIgnored(device)) return msg += '(IGNORED)';
    return msg += (
      this.isConnecting(device) ? '(CONNECTING)'
      : this.isConnected(device) ? '(CONNECTED)'
      : this.isFailed(device) ? '(FAILED)'
      : '(NEW)');
  }

}