import { Track } from '../types';
export declare class DbConnection {
    private db;
    private dbPath;
    constructor(dbPath: string);
    /**
     * Execute a SQL query.
     *
     * @param query SQL query to execute
     * @param params Parameters for BetterSqlite3 result.all.
     * @returns
     */
    querySource<T>(query: string, ...params: any[]): T[];
    /**
     * Return track's DB entry.
     *
     * @param trackPath Path of track on the source's filesystem.
     * @returns
     */
    getTrackInfo(trackPath: string): Track;
    close(): void;
}
