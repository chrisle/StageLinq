# EAAS (Engine Application & Streaming)

EAAS provides advanced Engine DJ integration via gRPC and HTTP protocols, allowing library queries and file downloads.

## Overview

EAAS runs on Engine DJ devices with two servers:

| Port | Protocol | Purpose |
|------|----------|---------|
| 50010 | gRPC | Library queries, search, playlists |
| 50020 | HTTP | File downloads, health check |

## Discovery

```ts
import { EAAS } from 'stagelinq';

const discoverer = new EAAS.EAASDiscoverer();

discoverer.on('deviceFound', (device) => {
  console.log(`Found: ${device.name} at ${device.address}`);
  console.log(`  gRPC: ${device.grpcPort}`);
  console.log(`  HTTP: ${device.httpPort}`);
});

discoverer.startScanning();
```

## HTTP Client

Download files from EAAS HTTP server:

```ts
import { EAAS } from 'stagelinq';

const client = new EAAS.EAASHttpClient({
  address: '192.168.1.100',
  port: 50020,
});

// Health check
const isHealthy = await client.ping();

// Download file
const audioData = await client.downloadFile('/path/to/track.mp3');
fs.writeFileSync('track.mp3', audioData);

// Download with progress
client.on('progress', (percent) => {
  console.log(`Download: ${percent}%`);
});
```

## gRPC Services

EAAS exposes two gRPC services:

### NetworkTrustService

Device authentication and trust management.

```ts
// Types available for custom gRPC implementation
import { EAAS } from 'stagelinq';

type TrustRequest = EAAS.NetworkTrustRequest;
type TrustResponse = EAAS.NetworkTrustResponse;
```

### EngineLibraryService

Library queries and search.

```ts
// Available gRPC types
type GetTrackRequest = EAAS.GetTrackRequest;
type GetTrackResponse = EAAS.GetTrackResponse;
type SearchTracksRequest = EAAS.SearchTracksRequest;
type SearchTracksResponse = EAAS.SearchTracksResponse;
type GetPlaylistRequest = EAAS.GetPlaylistRequest;
type GetCrateRequest = EAAS.GetCrateRequest;
```

## Beacon

Announce your application as an EAAS service:

```ts
import { EAAS } from 'stagelinq';

const beacon = new EAAS.EAASBeacon({
  name: 'My App',
  grpcPort: 50010,
  httpPort: 50020,
});

beacon.start();

// Later...
beacon.stop();
```

## gRPC Implementation Note

The gRPC client requires a gRPC runtime library (e.g., `@grpc/grpc-js`). This library provides TypeScript types for the EAAS protocol but does not include the gRPC runtime to keep the package lightweight.

To use gRPC features:

```bash
npm install @grpc/grpc-js @grpc/proto-loader
```

## Attribution

EAAS module ported from [go-stagelinq](https://github.com/icedream/go-stagelinq) by Carl Kittelberger (icedream).
