"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbConnection = void 0;
const Database = require("better-sqlite3-multiple-ciphers");
class DbConnection {
    constructor(dbPath) {
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
    querySource(query, ...params) {
        console.debug(`Querying ${this.dbPath}: ${query} (${params.join(', ')})`);
        const result = this.db.prepare(query);
        // @ts-ignore
        return result.all(params);
    }
    /**
     * Return track's DB entry.
     *
     * @param trackPath Path of track on the source's filesystem.
     * @returns
     */
    getTrackInfo(trackPath) {
        let result;
        if (/streaming:\/\//.test(trackPath)) {
            result = this.querySource('SELECT * FROM Track WHERE uri = (?) LIMIT 1', trackPath);
        }
        else {
            result = this.querySource('SELECT * FROM Track WHERE path = (?) LIMIT 1', trackPath);
        }
        if (!result)
            throw new Error(`Could not find track: ${trackPath} in database.`);
        return result[0];
    }
    close() {
        console.debug(`Closing ${this.dbPath}`);
        this.db.close();
    }
}
exports.DbConnection = DbConnection;
//# sourceMappingURL=DbConnection.js.map