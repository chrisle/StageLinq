/**
 * EAAS gRPC Types
 *
 * TypeScript type definitions for EAAS gRPC protocol.
 * These types mirror the protobuf definitions from go-stagelinq.
 *
 * Note: In production, these should be generated from .proto files using
 * protoc with ts-proto or similar. These manual definitions provide
 * type safety for development.
 *
 * Ported from go-stagelinq by Carl Kittelberger (icedream)
 * Original: https://github.com/icedream/go-stagelinq
 * License: MIT
 */

//////////////////////////////////////////////////////////////////////////////
// Enums
//////////////////////////////////////////////////////////////////////////////

export enum LibraryLogo {
  LIBRARY_LOGO_UNSPECIFIED = 0,
  LIBRARY_LOGO_ENGINE = 1,
  LIBRARY_LOGO_APPLE_MUSIC = 2,
  LIBRARY_LOGO_REKORDBOX = 3,
  LIBRARY_LOGO_SERATO = 4,
  LIBRARY_LOGO_TRAKTOR = 5,
}

export enum PlaylistListType {
  PLAYLIST_LIST_TYPE_UNSPECIFIED = 0,
  PLAYLIST_LIST_TYPE_PLAY = 1,
  PLAYLIST_LIST_TYPE_SMART = 2,
}

export enum SearchQueryField {
  SEARCH_QUERY_FIELD_UNSPECIFIED = 0,
  SEARCH_QUERY_FIELD_TITLE = 1,
  SEARCH_QUERY_FIELD_ARTIST = 2,
  SEARCH_QUERY_FIELD_ALBUM = 3,
  SEARCH_QUERY_FIELD_LENGTH = 4,
  SEARCH_QUERY_FIELD_KEY = 5,
  SEARCH_QUERY_FIELD_COMMENT = 6,
  SEARCH_QUERY_FIELD_BPM = 7,
  SEARCH_QUERY_FIELD_GENRE = 8,
  SEARCH_QUERY_FIELD_LABEL = 9,
  SEARCH_QUERY_FIELD_YEAR = 10,
  SEARCH_QUERY_FIELD_DATE_ADDED = 11,
  SEARCH_QUERY_FIELD_FILENAME = 12,
}

export enum SearchFilterField {
  SEARCH_FILTER_FIELD_UNSPECIFIED = 0,
  SEARCH_FILTER_FIELD_GENRE = 1,
  SEARCH_FILTER_FIELD_ARTIST = 2,
  SEARCH_FILTER_FIELD_ALBUM = 3,
  SEARCH_FILTER_FIELD_BPM = 4,
  SEARCH_FILTER_FIELD_KEY = 5,
}

export enum SortField {
  SORT_FIELD_UNSPECIFIED = 0,
  SORT_FIELD_TITLE = 1,
  SORT_FIELD_ARTIST = 2,
  SORT_FIELD_ALBUM = 3,
  SORT_FIELD_BPM = 4,
  SORT_FIELD_GENRE = 5,
  SORT_FIELD_COMMENT = 6,
  SORT_FIELD_LABEL = 7,
  SORT_FIELD_LENGTH = 8,
  SORT_FIELD_KEY = 9,
  SORT_FIELD_RATING = 10,
  SORT_FIELD_YEAR = 11,
  SORT_FIELD_ORDER_PLAYLIST = 12,
  SORT_FIELD_DATE_ADDED = 13,
}

export enum SortDirection {
  SORT_DIRECTION_UNSPECIFIED = 0,
  SORT_DIRECTION_ASCENDING = 1,
  SORT_DIRECTION_DESCENDING = 2,
}

//////////////////////////////////////////////////////////////////////////////
// Library Types
//////////////////////////////////////////////////////////////////////////////

export interface Library {
  id: string;
  title: string;
  logo: LibraryLogo;
}

export interface PlaylistMetadata {
  id: string;
  title: string;
  trackCount: number;
  playlists: PlaylistMetadata[];
  listType: PlaylistListType;
}

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  key: string;
  rating: number;
  year: number;
  genre: string;
  bpm: number;
  duration: number; // Duration in milliseconds
  composer: string;
  remixer: string;
  comment: string;
  label: string;
  dateAdded: string; // ISO date string
}

export interface BeatGridMarker {
  sampleOffset: number;
  beatNumber: number;
  beatsPerBar: number;
  bpm: number;
}

export interface BeatGrid {
  isAnalyzed: boolean;
  markers: BeatGridMarker[];
}

export interface QuickCue {
  index: number;
  sampleOffset: number;
  label: string;
  color: string; // Hex color
}

export interface Loop {
  index: number;
  startSampleOffset: number;
  endSampleOffset: number;
  label: string;
  color: string;
}

export interface OverviewWaveform {
  samplesPerEntry: number;
  data: Uint8Array;
}

export interface TrackPerformanceData {
  beatGrid: BeatGrid;
  quickCues: QuickCue[];
  loops: Loop[];
  mainCueSampleOffset: number;
  overviewWaveform: OverviewWaveform;
  initialImportSource: string;
  bpm: number;
}

export interface BlobProvider {
  type: string;
  id: string;
}

export interface TrackLocation {
  blobProvider: BlobProvider;
  storageKey: string;
}

export interface Track {
  id: string;
  metadata: TrackMetadata;
  performanceData: TrackPerformanceData;
  location: TrackLocation;
}

//////////////////////////////////////////////////////////////////////////////
// Search & Filter Types
//////////////////////////////////////////////////////////////////////////////

export interface SearchQuery {
  field: SearchQueryField;
  value: string;
}

export interface SearchFilter {
  field: SearchFilterField;
  values: string[];
}

export interface Sort {
  field: SortField;
  direction: SortDirection;
}

export interface Pagination {
  offset: number;
  limit: number;
}

//////////////////////////////////////////////////////////////////////////////
// Request/Response Types
//////////////////////////////////////////////////////////////////////////////

// GetLibraries
export interface GetLibrariesRequest {}

export interface GetLibrariesResponse {
  libraries: Library[];
}

// GetLibrary
export interface GetLibraryRequest {
  libraryId: string;
}

export interface GetLibraryResponse {
  playlists: PlaylistMetadata[];
}

// GetTracks
export interface GetTracksRequest {
  libraryId: string;
  playlistId?: string;
  filters?: SearchFilter[];
  sort?: Sort;
  pagination?: Pagination;
}

export interface GetTracksResponse {
  tracks: Track[];
  totalCount: number;
}

// GetTrack
export interface GetTrackRequest {
  libraryId: string;
  trackId: string;
}

export interface GetTrackResponse {
  track: Track;
}

// SearchTracks
export interface SearchTracksRequest {
  libraryId: string;
  query: SearchQuery;
  filters?: SearchFilter[];
  sort?: Sort;
  pagination?: Pagination;
}

export interface SearchTracksResponse {
  tracks: Track[];
  totalCount: number;
}

// GetSearchFilters
export interface GetSearchFiltersRequest {
  libraryId: string;
  playlistId?: string;
}

export interface FilterOption {
  value: string;
  count: number;
}

export interface GetSearchFiltersResponse {
  genres: FilterOption[];
  artists: FilterOption[];
  albums: FilterOption[];
  bpms: FilterOption[];
  keys: FilterOption[];
}

// GetHistorySessions
export interface GetHistorySessionsRequest {
  libraryId: string;
  pagination?: Pagination;
}

export interface HistorySession {
  id: string;
  startTime: string;
  endTime: string;
  trackCount: number;
}

export interface GetHistorySessionsResponse {
  sessions: HistorySession[];
  totalCount: number;
}

// GetHistoryPlayedTracks
export interface GetHistoryPlayedTracksRequest {
  libraryId: string;
  sessionId?: string;
  pagination?: Pagination;
}

export interface HistoryPlayedTrack {
  track: Track;
  playedAt: string;
  playDuration: number;
}

export interface GetHistoryPlayedTracksResponse {
  playedTracks: HistoryPlayedTrack[];
  totalCount: number;
}

// GetCredentials
export interface GetCredentialsRequest {}

export interface GetCredentialsResponse {
  credentials: Record<string, string>;
}

//////////////////////////////////////////////////////////////////////////////
// Event Types
//////////////////////////////////////////////////////////////////////////////

export interface EventStreamRequest {}

export interface EventPlaylistHierarchyChanged {
  libraryId: string;
}

export interface EventPlaylistsContentChanged {
  libraryId: string;
  playlistIds: string[];
}

export interface EventTrackMetadataChanged {
  libraryId: string;
  trackIds: string[];
}

export interface EventTrackPerformanceDataChanged {
  libraryId: string;
  trackIds: string[];
}

export type LibraryEvent =
  | { type: 'playlistHierarchyChanged'; event: EventPlaylistHierarchyChanged }
  | { type: 'playlistsContentChanged'; event: EventPlaylistsContentChanged }
  | { type: 'trackMetadataChanged'; event: EventTrackMetadataChanged }
  | { type: 'trackPerformanceDataChanged'; event: EventTrackPerformanceDataChanged };

export interface EventStreamResponse {
  events: LibraryEvent[];
}

// PutEvents
export interface PutEventsRequest {
  events: LibraryEvent[];
}

export interface PutEventsResponse {}

//////////////////////////////////////////////////////////////////////////////
// Network Trust Types
//////////////////////////////////////////////////////////////////////////////

export interface CreateTrustRequest {
  ed25519PublicKey?: Uint8Array;
  wireguardPort?: number;
  deviceName?: string;
}

export interface CreateTrustGranted {
  // Success, no additional data
}

export interface CreateTrustDenied {
  reason: string;
}

export enum CreateTrustBusyReason {
  CREATE_TRUST_BUSY_REASON_UNSPECIFIED = 0,
  CREATE_TRUST_BUSY_REASON_RATE_LIMITED = 1,
  CREATE_TRUST_BUSY_REASON_BUSY = 2,
}

export interface CreateTrustBusy {
  reason: CreateTrustBusyReason;
}

export type CreateTrustResponse =
  | { status: 'granted'; granted: CreateTrustGranted }
  | { status: 'denied'; denied: CreateTrustDenied }
  | { status: 'busy'; busy: CreateTrustBusy };
