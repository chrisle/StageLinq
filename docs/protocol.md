# StageLinQ Protocol Documentation

This document describes the StageLinQ network protocol used by Denon DJ devices
for communication between players, mixers, and software applications.

Based on reverse engineering work from:
- chrisle/StageLinq (TypeScript)
- icedream/go-stagelinq (Go)
- Jaxc/PyStageLinQ (Python)

## Overview

StageLinQ is a proprietary protocol developed by Denon DJ (inMusic) for
networking their DJ equipment. It enables:

- Device discovery on local networks
- Real-time state synchronization
- File transfers (databases, audio files)
- Beat and timing information sharing
- Library browsing (via EAAS)

## Network Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        StageLinQ Network                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐     UDP 51337      ┌─────────────┐              │
│  │   SC6000    │◄──────────────────►│   SC6000    │              │
│  │  (Player)   │                    │  (Player)   │              │
│  └──────┬──────┘                    └──────┬──────┘              │
│         │                                  │                     │
│         │ TCP (Dynamic Ports)              │                     │
│         │                                  │                     │
│  ┌──────▼──────┐                    ┌──────▼──────┐              │
│  │   X1850     │                    │  Software   │              │
│  │  (Mixer)    │                    │ (Now Playing│              │
│  └─────────────┘                    │  SoundSwitch│              │
│                                     │  Resolume)  │              │
│                                     └─────────────┘              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 51337 | UDP | Discovery announcements |
| Dynamic | TCP | Service connections (StateMap, FileTransfer, etc.) |
| 11224 | UDP | EAAS discovery |
| 50010 | TCP | EAAS gRPC |
| 50020 | TCP | EAAS HTTP |

## Data Types

All multi-byte values are **big-endian** (network byte order).

| Type | Size | Description |
|------|------|-------------|
| UInt8 | 1 | Unsigned 8-bit integer |
| UInt16 | 2 | Unsigned 16-bit integer, big-endian |
| UInt32 | 4 | Unsigned 32-bit integer, big-endian |
| UInt64 | 8 | Unsigned 64-bit integer, big-endian |
| Int32 | 4 | Signed 32-bit integer, big-endian |
| Float64 | 8 | IEEE 754 double, big-endian |
| Token | 16 | Device identifier (UUID bytes) |
| NetworkStringUTF16 | 4+n | Length-prefixed UTF-16BE string |

### NetworkStringUTF16 Format

```
┌────────────────┬─────────────────────────────────┐
│ Length (UInt32)│ UTF-16BE Characters             │
│ (byte count)   │ (length / 2 characters)         │
└────────────────┴─────────────────────────────────┘
```

Note: The length field contains the byte count, not character count.

## Discovery Protocol (UDP 51337)

Devices announce themselves and discover others via UDP broadcasts.

### Magic Bytes

```
"airD" (0x61 0x69 0x72 0x44)
```

### Message Format

```
┌──────────────────────────────────────────────────────────────┐
│ Offset │ Size │ Field              │ Description             │
├────────┼──────┼────────────────────┼─────────────────────────┤
│ 0      │ 4    │ Magic              │ "airD"                  │
│ 4      │ 16   │ Token              │ Device identifier       │
│ 20     │ var  │ Source             │ Device source name      │
│ var    │ var  │ Action             │ Login/Logout action     │
│ var    │ var  │ Software Name      │ Device/software name    │
│ var    │ var  │ Software Version   │ Version string          │
│ var    │ 2    │ Port               │ TCP service port        │
└──────────────────────────────────────────────────────────────┘
```

### Actions

| Action | Description |
|--------|-------------|
| `DISCOVERER_HOWDY_` | Device announcing presence (login) |
| `DISCOVERER_EXIT_` | Device leaving network (logout) |

### Device Identification

Common software names:
- `SC6000`, `SC6000M` - Players
- `SC5000`, `SC5000M` - Players
- `Prime 4`, `Prime 2`, `Prime Go` - All-in-one units
- `X1850`, `X1800` - Mixers
- `JM08` - Mixer (ignored by most software)
- `SoundSwitch` - Lighting software
- `Resolume` - VJ software
- `OfflineAnalyzer` - Track analysis (ignored)
- `SSS0` - SoundSwitch Embedded (ignored)

## Service Protocol (TCP)

After discovery, devices connect via TCP for service communication.

### Connection Handshake

1. Client connects to device's announced TCP port
2. Device sends `ServicesRequest` message
3. Client sends `ServicesRequest` with its token
4. Device announces available services
5. Client connects to desired service ports

### Message IDs

| ID | Name | Description |
|----|------|-------------|
| 0x0 | ServicesAnnouncement | Announce a service and its port |
| 0x1 | TimeStamp | Time synchronization |
| 0x2 | ServicesRequest | Request service list |

### ServicesAnnouncement Format

```
┌──────────────────────────────────────────────────────────────┐
│ Offset │ Size │ Field              │ Description             │
├────────┼──────┼────────────────────┼─────────────────────────┤
│ 0      │ 4    │ Message ID         │ 0x00000000              │
│ 4      │ 16   │ Token              │ Device token            │
│ 20     │ var  │ Service Name       │ e.g., "StateMap"        │
│ var    │ 2    │ Port               │ Service TCP port        │
└──────────────────────────────────────────────────────────────┘
```

### Available Services

| Service | Description |
|---------|-------------|
| StateMap | Real-time state synchronization |
| FileTransfer | File downloads |
| BeatInfo | Beat and timing data |
| TimeSync | Clock synchronization |
| Directory | Service directory |
| Broadcast | Broadcast messages |

## StateMap Service

Real-time state updates for track info, playback status, mixer positions.

### Magic Bytes

```
"smaa" (0x73 0x6D 0x61 0x61)
```

### Message Types

| Type ID | Name | Description |
|---------|------|-------------|
| 0x00000000 | JSON State | State name + JSON value |
| 0x000007d2 | Interval Subscription | Subscribe with interval |

### JSON State Message

```
┌──────────────────────────────────────────────────────────────┐
│ Offset │ Size │ Field              │ Description             │
├────────┼──────┼────────────────────┼─────────────────────────┤
│ 0      │ 4    │ Magic              │ "smaa"                  │
│ 4      │ 4    │ Type               │ 0x00000000              │
│ 8      │ var  │ State Name         │ e.g., "/Engine/Deck1/Play" │
│ var    │ var  │ JSON Value         │ State value as JSON     │
└──────────────────────────────────────────────────────────────┘
```

### Common State Paths

#### Track Information
- `/Engine/Deck1/Track/SongName` - Track title
- `/Engine/Deck1/Track/ArtistName` - Artist name
- `/Engine/Deck1/Track/TrackNetworkPath` - Network path
- `/Engine/Deck1/Track/TrackLength` - Duration in seconds

#### Playback
- `/Engine/Deck1/Play` - Play state (boolean)
- `/Engine/Deck1/PlayState` - Detailed play state
- `/Engine/Deck1/CurrentBPM` - Current BPM (float)
- `/Engine/Deck1/Speed` - Playback speed

#### Sync
- `/Engine/Deck1/SyncMode` - Sync mode
- `/Engine/Deck1/DeckIsMaster` - Is master deck

#### Mixer
- `/Mixer/CH1faderPosition` - Channel fader (0.0-1.0)
- `/Mixer/CrossfaderPosition` - Crossfader position
- `/Mixer/CH1OnAir` - Channel on-air status

See `types/models/State.ts` for the complete list (~246 states).

## FileTransfer Service

Downloads files from devices including databases and audio files.

### Magic Bytes

```
"fltx" (0x66 0x6C 0x74 0x78)
```

### Message IDs

| ID | Name | Description |
|----|------|-------------|
| 0x0 | TimeCode | Time synchronization |
| 0x1 | FileStat | File metadata (size, etc.) |
| 0x2 | EndOfMessage | Transfer complete |
| 0x3 | SourceLocations | Available media sources |
| 0x4 | FileTransferId | Start file transfer |
| 0x5 | FileTransferChunk | File data chunk |
| 0x8 | Unknown | Unknown purpose |
| 0x9 | ServiceDisconnect | Disconnect service |

### SourceLocations Message

```
┌──────────────────────────────────────────────────────────────┐
│ Offset │ Size │ Field              │ Description             │
├────────┼──────┼────────────────────┼─────────────────────────┤
│ 0      │ 4    │ Magic              │ "fltx"                  │
│ 4      │ 4    │ Type ID            │ 0x00000000              │
│ 8      │ 4    │ Message ID         │ 0x00000003              │
│ 12     │ 4    │ Source Count       │ Number of sources       │
│ 16     │ var  │ Source Names       │ Array of NetworkStrings │
│ var    │ 3    │ Padding            │ 0x01 0x01 0x01          │
└──────────────────────────────────────────────────────────────┘
```

### File Transfer Flow

1. Request file with path
2. Receive FileStat (size, metadata)
3. Receive FileTransferChunk messages
4. Receive EndOfMessage

## BeatInfo Service

Real-time beat and timing information for each deck.

### Message Format

```
┌──────────────────────────────────────────────────────────────┐
│ Offset │ Size │ Field              │ Description             │
├────────┼──────┼────────────────────┼─────────────────────────┤
│ 0      │ 4    │ ID                 │ Message identifier      │
│ 4      │ 8    │ Clock              │ Timestamp (nanoseconds) │
│ 12     │ 4    │ Deck Count         │ Number of decks         │
│ 16     │ 24*n │ Deck Data          │ Per-deck beat info      │
│ var    │ 8*n  │ Sample Positions   │ Optional sample offsets │
└──────────────────────────────────────────────────────────────┘

Deck Data (24 bytes per deck):
┌──────────────────────────────────────────────────────────────┐
│ Offset │ Size │ Field              │ Description             │
├────────┼──────┼────────────────────┼─────────────────────────┤
│ 0      │ 8    │ Beat               │ Current beat (Float64)  │
│ 8      │ 8    │ Total Beats        │ Total beats (Float64)   │
│ 16     │ 8    │ BPM                │ Current BPM (Float64)   │
└──────────────────────────────────────────────────────────────┘
```

## Known Device Tokens

Tokens are 16-byte UUIDs identifying devices.

| Hex | Device |
|-----|--------|
| `52fdfcc721826541563f5f0f9a621d72` | SoundSwitch |
| `828beb02da1f4e68a6afb0b167eaf0a2` | SC6000 (default 1) |
| `26d238671cd64e3f80a111826ac41120` | SC6000 (default 2) |
| `88fa2099ac7a4f3fbc16a995dbda2a42` | Resolume |

## EAAS Protocol

Engine Application & Streaming provides modern gRPC/HTTP APIs.

### Discovery (UDP 11224)

```
Request:  "EAAS" + 0x01 0x00 (6 bytes)
Response: "EAAS" + 0x01 0x01 + Token + Hostname + URL + Version
```

### gRPC Services (Port 50010)

- **EngineLibraryService** - Library access, search, tracks
- **NetworkTrustService** - Device authentication

### HTTP Endpoints (Port 50020)

- `GET /ping` - Health check
- `GET /download/{path}` - File download

## References

- [icedream/go-stagelinq](https://github.com/icedream/go-stagelinq)
- [Jaxc/PyStageLinQ](https://github.com/Jaxc/PyStageLinQ)
- [PyStageLinQ Documentation](https://pystagelinq.readthedocs.io/)
