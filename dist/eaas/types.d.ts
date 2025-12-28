/**
 * EAAS Types
 *
 * Type definitions for Engine Application & Streaming (EAAS) protocol.
 *
 * Ported from go-stagelinq by Carl Kittelberger (icedream)
 * Original: https://github.com/icedream/go-stagelinq
 * License: MIT
 */
/** EAAS discovery port */
export declare const EAAS_DISCOVERY_PORT = 11224;
/** Default EAAS gRPC port */
export declare const EAAS_GRPC_PORT = 50010;
/** Default EAAS HTTP port (gRPC port + 10) */
export declare const EAAS_HTTP_PORT = 50020;
/** Magic bytes for EAAS discovery messages */
export declare const EAAS_MAGIC = "EAAS";
/** Discovery request type byte */
export declare const EAAS_REQUEST_TYPE = 0;
/** Discovery response type byte */
export declare const EAAS_RESPONSE_TYPE = 1;
/**
 * EAAS Device information received from discovery
 */
export interface EAASDevice {
    /** Network URL for connecting to device (e.g., "192.168.1.100") */
    url: string;
    /** Device hostname/name */
    hostname: string;
    /** Software version string */
    softwareVersion: string;
    /** EAAS gRPC port */
    grpcPort: number;
    /** EAAS HTTP port */
    httpPort: number;
    /** Device token (16 bytes) */
    token: Uint8Array;
    /** Remote address the response came from */
    address: string;
}
/**
 * EAAS Discoverer configuration options
 */
export interface EAASDiscovererOptions {
    /** Discovery timeout in milliseconds (default: 5000) */
    timeout?: number;
    /** Interval for periodic scanning in milliseconds (default: 10000) */
    scanInterval?: number;
}
/**
 * EAAS Beacon configuration options
 */
export interface EAASBeaconOptions {
    /** Device name to announce */
    name: string;
    /** Software version to announce */
    softwareVersion: string;
    /** Token to use (auto-generated if not provided) */
    token?: Uint8Array;
    /** gRPC host (defaults to bound interface IP) */
    grpcHost?: string;
    /** gRPC port (default: 50010) */
    grpcPort?: number;
}
