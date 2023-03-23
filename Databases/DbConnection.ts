import Database = require('better-sqlite3');
import { Track } from '../types';
import { Logger } from '../LogEmitter';
import { inflate as Inflate } from 'zlib'

export class DbConnection {

  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    Logger.debug(`Opening ${this.dbPath}`);
    this.db = new Database(this.dbPath);
  }

  /**
   * Execute a SQL query.
   *
   * @param query SQL query to execute
   * @param params Parameters for BetterSqlite3 result.all.
   * @returns
   */
  querySource<T>(query: string, ...params: any[]): T[] {
    Logger.debug(`Querying ${this.dbPath}: ${query} (${params.join(', ')})`);
    const result = this.db.prepare(query);
    return result.all(params);
  }


  async inflate(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      Inflate(data.slice(4), (err, buffer) => {
        if (err) {
          reject(err);
        } else {
          resolve(buffer);
        }
      });
    });
  }

  /**
   * Return track's DB entry.
   *
   * @param trackPath Path of track on the source's filesystem.
   * @returns
   */
  async getTrackInfo(_trackPath: string): Promise<Track> {
    let result: Track[];

    //console.dir(_trackPath.split('/'))
    const trackPath = _trackPath.split('/').slice(5, _trackPath.length).join('/')
    //console.log(trackPath)
    //if (/streaming:\/\//.test(trackPath)) {
    //  result = this.querySource('SELECT * FROM Track WHERE uri = (?) LIMIT 1', trackPath);
    //} else {
    result = this.querySource('SELECT * FROM Track WHERE path = (?) LIMIT 1', trackPath);
    //}
    if (!result) throw new Error(`Could not find track: ${trackPath} in database.`);
    result[0].trackData = await this.inflate(result[0].trackData);
    result[0].overviewWaveFormData = await this.inflate(result[0].overviewWaveFormData);
    result[0].beatData = await this.inflate(result[0].beatData);

    return result[0];
  }

  close() {
    Logger.debug(`Closing ${this.dbPath}`);
    this.db.close();
  }

}
