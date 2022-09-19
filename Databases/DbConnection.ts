import Database = require('better-sqlite3');


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
    console.debug(`Querying ${this.dbPath}: `);
    const result = this.db.prepare(query);
    return result.all(params);
  }

  /**
   * Return track's DB entry.
   *
   * @param trackPath Path of track on the source's filesystem.
   * @returns
   */
  getTrackInfo(trackPath: string) {
    return this.querySource(`SELECT * FROM Track WHERE path = '${trackPath}'`);
  }

  close() {
    console.debug(`Closing ${this.dbPath}`);
    this.db.close();
  }
}
