/**
 * A row of the Track table in an Engine database (m.db).
 *
 * Matches Engine schema 3.0.2, as shipped by Engine DJ 5. That release moved
 * the per-track performance blobs — waveform, beat grid, quick cues, loops —
 * out of this table into PerformanceData and the OverviewData directory, so
 * they are no longer columns here.
 */
export interface Track {
  id: number,
  playOrder: number,
  length: number,
  bpm: number,
  year: number,
  path: string,
  filename: string,
  bitrate: number,
  bpmAnalyzed: number,
  albumArtId: number,
  fileBytes: number,
  title: string,
  artist: string,
  album: string,
  genre: string,
  comment: string,
  label: string,
  composer: string,
  remixer: string,
  key: number,
  rating: number,
  albumArt: string,
  timeLastPlayed: string,
  isPlayed: boolean,
  fileType: string,
  isAnalyzed: boolean,
  dateCreated: string,
  dateAdded: string,
  isAvailable: boolean,
  isMetadataOfPackedTrackChanged: boolean,
  isPerfomanceDataOfPackedTrackChanged: boolean,
  playedIndicator: number,
  isMetadataImported: boolean,
  pdbImportKey: number,
  streamingSource: string,
  uri: string,
  isBeatGridLocked: boolean,
  originDatabaseUuid: string,
  originTrackId: number,
  streamingFlags: number,
  explicitLyrics: boolean,
  lastEditTime: string,
  albumArtSourceHash: string
}