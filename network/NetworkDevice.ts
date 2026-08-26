import type { Logger } from '../types/logger';
import { noopLogger } from '../types/logger';
import { ReadContext } from '../utils/ReadContext';
import { ServicePorts, ConnectionInfo, LISTEN_TIMEOUT, MessageId, Tokens } from '../types';
import { sleep } from '../utils/sleep';
import { parseNetworkPath } from '../utils/trackPath';
import { strict as assert } from 'assert';
import { WriteContext } from '../utils/WriteContext';
import * as FileType from 'file-type';
import * as fs from 'fs';
import * as services from '../services';
import * as tcp from '../utils/tcp';
import Database from 'better-sqlite3-multiple-ciphers';

interface SourceAndTrackPath {
  source: string;
  trackPath: string;
}

export class NetworkDevice {
  private connection: tcp.Connection | null = null;
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
  private logger: Logger;

  /** Trailing bytes of a partially-received message, held for the next read. */
  private queue: Buffer | null = null;

  /** Message ids already warned about, so a desync logs once and not per read. */
  private readonly warnedMessageIds = new Set<number>();

  /** uint32 message id + 16 byte device token. */
  private static readonly HEADER_BYTES = 20;

  /**
   * Longest UTF-16 service name a ServicesAnnouncement may claim, in bytes.
   * A larger prefix means framing is lost rather than that a big message is
   * still on its way, and without the cap the queue would grow forever.
   */
  private static readonly MAX_SERVICE_NAME_BYTES = 1024;

  constructor(info: ConnectionInfo, logger: Logger = noopLogger) {
    this.connectionInfo = info;
    this.logger = logger;
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
    this.logger.debug(`Attempting to connect to ${info.address}:${info.port}`);
    this.connection = await tcp.connect(info.address, info.port, this.logger);
    this.queue = null;
    this.connection.socket.on('data', (p_message: Buffer) => {
      this.messageHandler(p_message);
    });
    await this.requestAllServicePorts();
  }

  disconnect(): void {
    // Disconnect all services
    for (const [key, service] of Object.entries(this.services)) {
      service.disconnect();
      delete this.services[key];
    }

    assert(this.connection);
    this.connection.destroy();
    this.connection = null;
    this.queue = null;
  }

  ///////////////////////////////////////////////////////////////////////////
  // Message Handler

  /**
   * Split one TCP read into whole messages and apply each.
   *
   * A read is an arbitrary slice of the stream, not a tidy list of messages:
   * one message can straddle two reads and several can arrive in one. Anything
   * left incomplete is held in `queue` and prepended to the next read. Before
   * this, a split message ran the parser off the end of the buffer and the
   * resulting assert escaped into the socket's 'data' handler, where it became
   * an uncaught exception.
   */
  messageHandler(p_message: Buffer): void {
    const buffer = this.queue && this.queue.length > 0 ? Buffer.concat([this.queue, p_message]) : p_message;

    // Bound the view to this Buffer's own bytes. `.buffer` alone is the whole
    // backing store, which for a pooled or concatenated Buffer holds bytes that
    // are not part of this message.
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const ctx = new ReadContext(arrayBuffer, false);
    this.queue = null;

    try {
      while (ctx.isEOF() === false) {
        const start = ctx.tell();
        const result = this.readMessage(ctx);

        if (result === 'need-more') {
          ctx.set(start);
          this.queue = ctx.readRemainingAsNewBuffer();
          break;
        }

        if (result === 'desync') {
          // The id is unknown, so the message length is too, and there is no
          // way to tell where the next one starts. Drop the rest of this read.
          ctx.set(start);
          this.logger.warn(`Lost framing on ${this.address}:${this.port}; dropping ${ctx.sizeLeft()} bytes`);
          break;
        }
      }
    } catch (err) {
      // Never let a parse failure reach the socket's 'data' handler, where it
      // would surface as an uncaught exception and take out the whole process.
      this.logger.error(
        `Failed to parse message from ${this.address}:${this.port}: ` +
          (err instanceof Error ? err.message : String(err))
      );
      this.queue = null;
    }
  }

  /**
   * Read exactly one message, or report why it could not be read.
   *
   * `need-more` means the bytes are valid but incomplete; the caller rewinds
   * and waits. `desync` means the stream no longer lines up with the protocol.
   */
  private readMessage(ctx: ReadContext): 'ok' | 'need-more' | 'desync' {
    if (ctx.sizeLeft() < NetworkDevice.HEADER_BYTES) {
      return 'need-more';
    }

    const id = ctx.readUInt32();
    // const deviceToken = ctx.read(16);
    ctx.seek(16);

    switch (id) {
      case MessageId.TimeStamp: {
        // 16 byte second token, then the uptime as a uint64
        if (ctx.sizeLeft() < 24) {
          return 'need-more';
        }
        // const secondToken = ctx.read(16); // should be 00..
        // we _shouldn't_ be receiving anything but blank tokens in the 2nd field
        // assert(secondToken.every((x) => x === 0));
        ctx.seek(16);

        // Time Alive is in nanoseconds; convert back to seconds
        this.timeAlive = Number(ctx.readUInt64() / (1000n * 1000n * 1000n));
        // this.sendTimeStampMsg(deviceToken, Tokens.SoundSwitch);
        return 'ok';
      }
      case MessageId.ServicesAnnouncement: {
        if (ctx.sizeLeft() < 4) {
          return 'need-more';
        }
        const nameBytes = ctx.readUInt32();
        ctx.seek(-4);

        if (nameBytes % 2 !== 0 || nameBytes > NetworkDevice.MAX_SERVICE_NAME_BYTES) {
          return 'desync';
        }
        // the length prefix, the name itself, and the uint16 port
        if (ctx.sizeLeft() < 4 + nameBytes + 2) {
          return 'need-more';
        }

        const service = ctx.readNetworkStringUTF16();
        const port = ctx.readUInt16();
        this.servicePorts[service] = port;
        return 'ok';
      }
      case MessageId.ServicesRequest:
        this.serviceRequestAllowed = true;
        return 'ok';
      default:
        if (!this.warnedMessageIds.has(id)) {
          this.warnedMessageIds.add(id);
          this.logger.warn(`Unhandled message id '${id}' from ${this.address}:${this.port}`);
        }
        return 'desync';
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
    new (p_address: string, p_port: number, p_controller: NetworkDevice, logger?: Logger): T;
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

    const service = new ctor(this.address, port, this, this.logger);

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
    const albumArtExtensions: Record<string, string> = {};
    for (const entry of result) {
      // @ts-ignore
      const filetype = await FileType.fromBuffer(entry.albumArt);
      // @ts-ignore
      if (filetype) albumArtExtensions[entry.id] = filetype.ext;
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
    this.logger.info(`dumped ${result.length} albums arts in '${path}'`);
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

  getAlbumArtPath(p_networkPath: string): string | null {
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

  /**
   * Parse a network path into source and track path components.
   *
   * Handles various Engine DJ folder structures including:
   * - Standard Engine Library/Music paths
   * - Custom library locations
   * - External USB drives
   * - RekordBox conversions
   *
   * Track path resolution based on kyleawayan/StageLinq
   * https://github.com/kyleawayan/StageLinq
   */
  private getSourceAndTrackFromNetworkPath(p_path: string): SourceAndTrackPath | null {
    const parsed = parseNetworkPath(p_path);

    if (!parsed) {
      return null;
    }

    return {
      source: parsed.sourceName,
      trackPath: parsed.trackPath,
    };
  }

  private async requestAllServicePorts(): Promise<void> {
    assert(this.connection);

    return new Promise(async (resolve, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Failed to requestServices for ` +
              `${this.connectionInfo.source} ` +
              `${this.connectionInfo.address}:${this.connectionInfo.port}`
          )
        );
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
      const written = await this.connection!.write(ctx.getBuffer());
      assert(written === ctx.tell());

      while (true) {
        // FIXME: How to determine when all services have been announced?
        if (Object.keys(this.servicePorts).length > 3) {
          this.logger.debug(`Discovered the following services on ${this.address}:${this.port}`);
          for (const [name, port] of Object.entries(this.servicePorts)) {
            this.logger.debug(`\tport: ${port} => ${name}`);
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
