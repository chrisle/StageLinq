"use strict";
/**
 * EAAS Types
 *
 * Type definitions for Engine Application & Streaming (EAAS) protocol.
 *
 * Ported from go-stagelinq by Carl Kittelberger (icedream)
 * Original: https://github.com/icedream/go-stagelinq
 * License: MIT
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EAAS_RESPONSE_TYPE = exports.EAAS_REQUEST_TYPE = exports.EAAS_MAGIC = exports.EAAS_HTTP_PORT = exports.EAAS_GRPC_PORT = exports.EAAS_DISCOVERY_PORT = void 0;
/** EAAS discovery port */
exports.EAAS_DISCOVERY_PORT = 11224;
/** Default EAAS gRPC port */
exports.EAAS_GRPC_PORT = 50010;
/** Default EAAS HTTP port (gRPC port + 10) */
exports.EAAS_HTTP_PORT = 50020;
/** Magic bytes for EAAS discovery messages */
exports.EAAS_MAGIC = 'EAAS';
/** Discovery request type byte */
exports.EAAS_REQUEST_TYPE = 0x00;
/** Discovery response type byte */
exports.EAAS_RESPONSE_TYPE = 0x01;
//# sourceMappingURL=types.js.map