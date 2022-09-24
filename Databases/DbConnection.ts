import Database = require('better-sqlite3');
import { Track } from '../types';


export class DbConnection {

  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    console.debug(`Opening ${this.dbPath}`);
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
    console.debug(`Querying ${this.dbPath}: ${query} (${params.join(', ')})`);
    const result = this.db.prepare(query);
    return result.all(params);
  }

  /**
   * Return track's DB entry.
   *
   * @param trackPath Path of track on the source's filesystem.
   * @returns
   */
  getTrackInfo(trackPath: string): Track {
    let result: Track[];
    if (/streaming:\/\//.test(trackPath)) {
      result = this.querySource('SELECT * FROM Track WHERE uri = (?) LIMIT 1', trackPath);
    } else {
      result = this.querySource('SELECT * FROM Track WHERE path = (?) LIMIT 1', trackPath);
    }
    if (!result) throw new Error(`Could not find track: ${trackPath} in database.`);
    return result[0];
  }

  close() {
    console.debug(`Closing ${this.dbPath}`);
    this.db.close();
  }

}
