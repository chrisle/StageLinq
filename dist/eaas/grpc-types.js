"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTrustBusyReason = exports.SortDirection = exports.SortField = exports.SearchFilterField = exports.SearchQueryField = exports.PlaylistListType = exports.LibraryLogo = void 0;
//////////////////////////////////////////////////////////////////////////////
// Enums
//////////////////////////////////////////////////////////////////////////////
var LibraryLogo;
(function (LibraryLogo) {
    LibraryLogo[LibraryLogo["LIBRARY_LOGO_UNSPECIFIED"] = 0] = "LIBRARY_LOGO_UNSPECIFIED";
    LibraryLogo[LibraryLogo["LIBRARY_LOGO_ENGINE"] = 1] = "LIBRARY_LOGO_ENGINE";
    LibraryLogo[LibraryLogo["LIBRARY_LOGO_APPLE_MUSIC"] = 2] = "LIBRARY_LOGO_APPLE_MUSIC";
    LibraryLogo[LibraryLogo["LIBRARY_LOGO_REKORDBOX"] = 3] = "LIBRARY_LOGO_REKORDBOX";
    LibraryLogo[LibraryLogo["LIBRARY_LOGO_SERATO"] = 4] = "LIBRARY_LOGO_SERATO";
    LibraryLogo[LibraryLogo["LIBRARY_LOGO_TRAKTOR"] = 5] = "LIBRARY_LOGO_TRAKTOR";
})(LibraryLogo = exports.LibraryLogo || (exports.LibraryLogo = {}));
var PlaylistListType;
(function (PlaylistListType) {
    PlaylistListType[PlaylistListType["PLAYLIST_LIST_TYPE_UNSPECIFIED"] = 0] = "PLAYLIST_LIST_TYPE_UNSPECIFIED";
    PlaylistListType[PlaylistListType["PLAYLIST_LIST_TYPE_PLAY"] = 1] = "PLAYLIST_LIST_TYPE_PLAY";
    PlaylistListType[PlaylistListType["PLAYLIST_LIST_TYPE_SMART"] = 2] = "PLAYLIST_LIST_TYPE_SMART";
})(PlaylistListType = exports.PlaylistListType || (exports.PlaylistListType = {}));
var SearchQueryField;
(function (SearchQueryField) {
    SearchQueryField[SearchQueryField["SEARCH_QUERY_FIELD_UNSPECIFIED"] = 0] = "SEARCH_QUERY_FIELD_UNSPECIFIED";
    SearchQueryField[SearchQueryField["SEARCH_QUERY_FIELD_TITLE"] = 1] = "SEARCH_QUERY_FIELD_TITLE";
    SearchQueryField[SearchQueryField["SEARCH_QUERY_FIELD_ARTIST"] = 2] = "SEARCH_QUERY_FIELD_ARTIST";
    SearchQueryField[SearchQueryField["SEARCH_QUERY_FIELD_ALBUM"] = 3] = "SEARCH_QUERY_FIELD_ALBUM";
    SearchQueryField[SearchQueryField["SEARCH_QUERY_FIELD_LENGTH"] = 4] = "SEARCH_QUERY_FIELD_LENGTH";
    SearchQueryField[SearchQueryField["SEARCH_QUERY_FIELD_KEY"] = 5] = "SEARCH_QUERY_FIELD_KEY";
    SearchQueryField[SearchQueryField["SEARCH_QUERY_FIELD_COMMENT"] = 6] = "SEARCH_QUERY_FIELD_COMMENT";
    SearchQueryField[SearchQueryField["SEARCH_QUERY_FIELD_BPM"] = 7] = "SEARCH_QUERY_FIELD_BPM";
    SearchQueryField[SearchQueryField["SEARCH_QUERY_FIELD_GENRE"] = 8] = "SEARCH_QUERY_FIELD_GENRE";
    SearchQueryField[SearchQueryField["SEARCH_QUERY_FIELD_LABEL"] = 9] = "SEARCH_QUERY_FIELD_LABEL";
    SearchQueryField[SearchQueryField["SEARCH_QUERY_FIELD_YEAR"] = 10] = "SEARCH_QUERY_FIELD_YEAR";
    SearchQueryField[SearchQueryField["SEARCH_QUERY_FIELD_DATE_ADDED"] = 11] = "SEARCH_QUERY_FIELD_DATE_ADDED";
    SearchQueryField[SearchQueryField["SEARCH_QUERY_FIELD_FILENAME"] = 12] = "SEARCH_QUERY_FIELD_FILENAME";
})(SearchQueryField = exports.SearchQueryField || (exports.SearchQueryField = {}));
var SearchFilterField;
(function (SearchFilterField) {
    SearchFilterField[SearchFilterField["SEARCH_FILTER_FIELD_UNSPECIFIED"] = 0] = "SEARCH_FILTER_FIELD_UNSPECIFIED";
    SearchFilterField[SearchFilterField["SEARCH_FILTER_FIELD_GENRE"] = 1] = "SEARCH_FILTER_FIELD_GENRE";
    SearchFilterField[SearchFilterField["SEARCH_FILTER_FIELD_ARTIST"] = 2] = "SEARCH_FILTER_FIELD_ARTIST";
    SearchFilterField[SearchFilterField["SEARCH_FILTER_FIELD_ALBUM"] = 3] = "SEARCH_FILTER_FIELD_ALBUM";
    SearchFilterField[SearchFilterField["SEARCH_FILTER_FIELD_BPM"] = 4] = "SEARCH_FILTER_FIELD_BPM";
    SearchFilterField[SearchFilterField["SEARCH_FILTER_FIELD_KEY"] = 5] = "SEARCH_FILTER_FIELD_KEY";
})(SearchFilterField = exports.SearchFilterField || (exports.SearchFilterField = {}));
var SortField;
(function (SortField) {
    SortField[SortField["SORT_FIELD_UNSPECIFIED"] = 0] = "SORT_FIELD_UNSPECIFIED";
    SortField[SortField["SORT_FIELD_TITLE"] = 1] = "SORT_FIELD_TITLE";
    SortField[SortField["SORT_FIELD_ARTIST"] = 2] = "SORT_FIELD_ARTIST";
    SortField[SortField["SORT_FIELD_ALBUM"] = 3] = "SORT_FIELD_ALBUM";
    SortField[SortField["SORT_FIELD_BPM"] = 4] = "SORT_FIELD_BPM";
    SortField[SortField["SORT_FIELD_GENRE"] = 5] = "SORT_FIELD_GENRE";
    SortField[SortField["SORT_FIELD_COMMENT"] = 6] = "SORT_FIELD_COMMENT";
    SortField[SortField["SORT_FIELD_LABEL"] = 7] = "SORT_FIELD_LABEL";
    SortField[SortField["SORT_FIELD_LENGTH"] = 8] = "SORT_FIELD_LENGTH";
    SortField[SortField["SORT_FIELD_KEY"] = 9] = "SORT_FIELD_KEY";
    SortField[SortField["SORT_FIELD_RATING"] = 10] = "SORT_FIELD_RATING";
    SortField[SortField["SORT_FIELD_YEAR"] = 11] = "SORT_FIELD_YEAR";
    SortField[SortField["SORT_FIELD_ORDER_PLAYLIST"] = 12] = "SORT_FIELD_ORDER_PLAYLIST";
    SortField[SortField["SORT_FIELD_DATE_ADDED"] = 13] = "SORT_FIELD_DATE_ADDED";
})(SortField = exports.SortField || (exports.SortField = {}));
var SortDirection;
(function (SortDirection) {
    SortDirection[SortDirection["SORT_DIRECTION_UNSPECIFIED"] = 0] = "SORT_DIRECTION_UNSPECIFIED";
    SortDirection[SortDirection["SORT_DIRECTION_ASCENDING"] = 1] = "SORT_DIRECTION_ASCENDING";
    SortDirection[SortDirection["SORT_DIRECTION_DESCENDING"] = 2] = "SORT_DIRECTION_DESCENDING";
})(SortDirection = exports.SortDirection || (exports.SortDirection = {}));
var CreateTrustBusyReason;
(function (CreateTrustBusyReason) {
    CreateTrustBusyReason[CreateTrustBusyReason["CREATE_TRUST_BUSY_REASON_UNSPECIFIED"] = 0] = "CREATE_TRUST_BUSY_REASON_UNSPECIFIED";
    CreateTrustBusyReason[CreateTrustBusyReason["CREATE_TRUST_BUSY_REASON_RATE_LIMITED"] = 1] = "CREATE_TRUST_BUSY_REASON_RATE_LIMITED";
    CreateTrustBusyReason[CreateTrustBusyReason["CREATE_TRUST_BUSY_REASON_BUSY"] = 2] = "CREATE_TRUST_BUSY_REASON_BUSY";
})(CreateTrustBusyReason = exports.CreateTrustBusyReason || (exports.CreateTrustBusyReason = {}));
//# sourceMappingURL=grpc-types.js.map