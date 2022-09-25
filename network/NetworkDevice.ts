import { Logger } from '../LogEmitter';
import { ReadContext } from '../utils/ReadContext';
import { ServicePorts, ConnectionInfo, LISTEN_TIMEOUT, MessageId, Tokens } from '../types';
import { sleep } from '../utils/sleep';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import * as FileType from 'file-type';
import * as fs from 'fs';
import * as services from '../services';
import * as tcp from '../utils/tcp';
import Database = require('better-sqlite3');


interface SourceAndTrackPath {
  source: string;
  trackPath: string;
}

export class NetworkDevice {
  private connection: tcp.Connection = null;
  //private source: string = null;
  private serviceRequestAllowed = false;
  private servicePorts: ServicePorts = {};
  private services: Record<string, InstanceType<typeof services.Service>> = {};
  private timeAlive: number = 0;
  private connectedSources: {
    [key: string]: {
      db: Database.Database;
      albumArt: {
        path: string;
        extensions: {
          [key: string]: string;
        };
      };
    };
  } = {};

  private connectionInfo: ConnectionInfo;

  constructor(info: ConnectionInfo) {
    this.connectionInfo = info;
  }

  private get address() {
    return this.connectionInfo.address;
  }

  private get port() {
    return this.connectionInfo.port;
  }

  ///////////////////////////////////////////////////////////////////////////
  // Connect / Disconnect

  async connect(): Promise<void> {
    const info = this.connectionInfo;
    Logger.debug(`Attempting to connect to ${info.address}:${info.port}`)
    this.connection = await tcp.connect(info.address, info.port);
    this.connection.socket.on('data', (p_message: Buffer) => {
      this.messageHandler(p_message);
    });
    await this.requestAllServicePorts();
  }

  disconnect(): void {
    // Disconnect all services
    for (const [key, service] of Object.entries(this.services)) {
      service.disconnect();
      this.services[key] = null;
    }

    assert(this.connection);
    this.connection.destroy();
    this.connection = null;
  }

  ///////////////////////////////////////////////////////////////////////////
  // Message Handler

  messageHandler(p_message: Buffer): void {
    const ctx = new ReadContext(p_message.buffer, false);
    while (ctx.isEOF() === false) {
      const id = ctx.readUInt32();
      // const deviceToken = ctx.read(16);
      ctx.seek(16);
      switch (id) {
        case MessageId.TimeStamp:
          ctx.seek(16);
          // const secondToken = ctx.read(16); // should be 00..
          // we _shouldn't_ be receiving anything but blank tokens in the 2nd field
          // assert(secondToken.every((x) => x === 0));

          // Time Alive is in nanoseconds; convert back to seconds
          this.timeAlive = Number(ctx.readUInt64() / (1000n * 1000n * 1000n));
          // this.sendTimeStampMsg(deviceToken, Tokens.SoundSwitch);
          break;
        case MessageId.ServicesAnnouncement:
          const service = ctx.readNetworkStringUTF16();
          const port = ctx.readUInt16();
          this.servicePorts[service] = port;
          break;
        case MessageId.ServicesRequest:
          this.serviceRequestAllowed = true;
          break;
        default:
          assert.fail(`NetworkDevice Unhandled message id '${id}'`);
      }
    }
  }

  ///////////////////////////////////////////////////////////////////////////
  // Public methods

  getPort(): number {
    return this.port;
  }
  getTimeAlive(): number {
    return this.timeAlive;
  }

  // Factory function
  async connectToService<T extends InstanceType<typeof services.Service>>(ctor: {
    new (p_address: string, p_port: number, p_controller: NetworkDevice): T;
  }): Promise<T> {
    assert(this.connection);
    // FIXME: find out why we need these waits before connecting to a service
    await sleep(500);

    const serviceName = ctor.name;

    if (this.services[serviceName]) {
      return this.services[serviceName] as T;
    }

    assert(this.servicePorts.hasOwnProperty(serviceName));
    assert(this.servicePorts[serviceName] > 0);
    const port = this.servicePorts[serviceName];

    const service = new ctor(this.address, port, this);

    await service.connect();
    this.services[serviceName] = service;
    return service;
  }

  // TODO: Refactor this out of here.
  async addSource(p_sourceName: string, p_localDbPath: string, p_localAlbumArtPath: string) {
    if (this.connectedSources[p_sourceName]) {
      return;
    }
    const db = new Database(p_localDbPath);

    // Get all album art extensions
    const stmt = db.prepare('SELECT * FROM AlbumArt WHERE albumArt NOT NULL');
    const result = stmt.all();
    const albumArtExtensions: Record<string, string | null> = {};
    for (const entry of result) {
      const filetype = await FileType.fromBuffer(entry.albumArt);
      albumArtExtensions[entry.id] = filetype ? filetype.ext : null;
    }

    this.connectedSources[p_sourceName] = {
      db: db,
      albumArt: {
        path: p_localAlbumArtPath,
        extensions: albumArtExtensions,
      },
    };
  }

  // TODO: Refactor this out of here.
  async dumpAlbumArt(p_sourceName: string) {
    if (!this.connectedSources[p_sourceName]) {
      assert.fail(`Source '${p_sourceName}' not connected`);
      return;
    }
    const path = this.connectedSources[p_sourceName].albumArt.path;
    if (fs.existsSync(path) === false) {
      fs.mkdirSync(path, { recursive: true });
    }

    const result = await this.querySource(p_sourceName, 'SELECT * FROM AlbumArt WHERE albumArt NOT NULL');
    for (const entry of result) {
      const filetype = await FileType.fromBuffer(entry.albumArt);
      const ext = filetype ? '.' + filetype.ext : '';
      const filepath = `${path}/${entry.id}${ext}`;
      fs.writeFileSync(filepath, entry.albumArt);
    }
    Logger.info(`dumped ${result.length} albums arts in '${path}'`);
  }

  // Database helpers

  querySource(p_sourceName: string, p_query: string, ...p_params: any[]): any[] {
    if (!this.connectedSources[p_sourceName]) {
      //assert.fail(`Source '${p_sourceName}' not connected`);
      return [];
    }
    const db = this.connectedSources[p_sourceName].db;
    const stmt = db.prepare(p_query);

    return stmt.all(p_params);
  }

  getAlbumArtPath(p_networkPath: string): string {
    const result = this.getSourceAndTrackFromNetworkPath(p_networkPath);
    if (!result) {
      return null;
    }

    const sql = 'SELECT * FROM Track WHERE path = ?';
    const dbResult = this.querySource(result.source, sql, result.trackPath);
    if (dbResult.length === 0) {
      return null;
    }

    assert(dbResult.length === 1); // there can only be one path
    const id = dbResult[0].idAlbumArt;
    const ext = this.connectedSources[result.source].albumArt.extensions[id];
    if (!ext) {
      return null;
    }

    return `${this.connectedSources[result.source].albumArt.path}${id}.${ext}`;
  }

  ///////////////////////////////////////////////////////////////////////////
  // Private methods

  private getSourceAndTrackFromNetworkPath(p_path: string): SourceAndTrackPath {
    if (!p_path || p_path.length === 0) {
      return null;
    }

    const parts = p_path.split('/');
    //assert(parts.length > )
    assert(parts[0] === 'net:');
    assert(parts[1] === '');
    assert(parts[2].length === 36);
    const source = parts[3];
    let trackPath = parts.slice(5).join('/');
    if (parts[4] !== 'Engine Library') {
      // This probably occurs with RekordBox conversions; tracks are outside Engine Library folder
      trackPath = `../${parts[4]}/${trackPath}`;
    }
    return {
      source: source,
      trackPath: trackPath,
    };
  }

  private async requestAllServicePorts(): Promise<void> {
    assert(this.connection);

    return new Promise(async (resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`Failed to requestServices for ` +
          `${this.connectionInfo.source} ` +
          `${this.connectionInfo.address}:${this.connectionInfo.port}`));
      }, LISTEN_TIMEOUT);

      // Wait for serviceRequestAllowed
      while (true) {
        if (this.serviceRequestAllowed) {
          break;
        }
        await sleep(250);
      }

      // FIXME: Refactor into message writer helper class
      const ctx = new WriteContext();
      ctx.writeUInt32(MessageId.ServicesRequest);
      ctx.write(Tokens.SoundSwitch);
      const written = await this.connection.write(ctx.getBuffer());
      assert(written === ctx.tell());

      while (true) {
        // FIXME: How to determine when all services have been announced?
        if (Object.keys(this.servicePorts).length > 3) {
          Logger.debug(`Discovered the following services on ${this.address}:${this.port}`);
          for (const [name, port] of Object.entries(this.servicePorts)) {
            Logger.debug(`\tport: ${port} => ${name}`);
          }
          resolve();
          break;
        }
        await sleep(250);
      }
    });
  }

  // private async sendTimeStampMsg(deviceToken: Uint8Array, userToken: Uint8Array, timeAlive?: bigint) {
  //   const ctx = new WriteContext();
  //   ctx.writeUInt32(MessageId.TimeStamp);
  //   ctx.write(deviceToken);
  //   ctx.write(userToken);
  //   const timeAliveNumber:bigint = (!!timeAlive) ? timeAlive : 0n;
  //   ctx.writeUInt64(timeAliveNumber);
  //   const written = await this.connection.write(ctx.getBuffer());
  //   assert(written === ctx.tell());
  // }
}
