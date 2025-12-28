# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2025-12-28

### Added

#### New Services
- **BeatInfo** - Real-time beat and tempo information from connected devices
  - Provides current beat, bar, and phrase positions
  - Reports BPM, time signature, and play state
  - Ported from go-stagelinq (icedream)
- **TimeSync** - Precise time synchronization with DJ hardware
  - Synchronized playback timing across devices
  - Ported from PyStageLinQ (Jaxc)
- **Broadcast** - Device presence broadcasting service
  - Announce presence to StageLinq network
  - Ported from PyStageLinQ (Jaxc)

#### EAAS (Engine Application & Streaming) Support
- Complete EAAS module for Engine DJ integration
- gRPC-based Engine Library access (types only - requires gRPC runtime)
- HTTP client for file downloads from EAAS server
- UDP discovery for EAAS devices
- Device beacon for announcing as EAAS service
- Ported from go-stagelinq (icedream)

#### Network Improvements
- **Windows broadcast fix** - Per-interface UDP sockets for reliable device discovery
  - Windows doesn't properly route broadcasts across interfaces
  - Creates separate socket for each network interface
  - Ported from go-stagelinq (icedream)
- **Connection health monitoring** - New `ConnectionHealth` class
  - Heartbeat-based connection monitoring
  - Automatic reconnection on connection loss
  - Configurable timeouts and retry attempts
  - Events for health status changes
- **Disconnect freezing fix** - Removed assertion that caused hangs
  - Fixed by kyleawayan/StageLinq

#### Utilities
- `formatToken()` - Format 16-byte token as UUID string
- `parseToken()` - Parse UUID string to 16-byte token
- `generateToken()` - Generate random device token
- `tokensEqual()` - Compare two tokens for equality
- `parseNetworkPath()` - Parse StageLinq network paths to database-compatible paths
  - Handles Engine Library/Music paths
  - Handles external USB drives
  - Handles RekordBox conversions
  - Ported from kyleawayan/StageLinq

#### Documentation
- Complete protocol documentation (`docs/protocol.md`)
  - Message formats and data types
  - Service discovery process
  - All service protocols documented
- Wireshark dissector for protocol analysis (`tools/wireshark/stagelinq.lua`)
  - Discovery message dissection
  - StateMap protocol support
  - FileTransfer protocol support
  - BeatInfo protocol support
  - Ported from PyStageLinQ (Jaxc)

#### CLI Tools
- `cli/discover.ts` - Network discovery demo
- `cli/beatinfo.ts` - Real-time beat information demo

#### Testing
- Comprehensive unit test suite using Vitest
- Tests for all utility functions
- Tests for ConnectionHealth monitoring

### Changed

- **Dual API pattern** - Both instance-based and static class APIs
  - `new StageLinq()` for instance-based usage
  - `StageLinq.connect()` for static/singleton usage
  - Maintains backward compatibility with existing code
- Updated TypeScript to 5.3.0
- Updated @types/node to 20.10.0
- Updated package.json for npm publishing preparation

### Fixed

- `WriteContext.autoGrow` option now properly respects `false` value
- Track path resolution for files outside Engine Library folder
- Connection disconnection no longer freezes the application

### Attribution

This release incorporates code and ideas from several StageLinq implementations:

- **go-stagelinq** by Carl Kittelberger (icedream) - MIT License
  - EAAS module, Windows broadcast fix, token utilities, BeatInfo service
  - https://github.com/icedream/go-stagelinq

- **PyStageLinQ** by Jaxc - MIT License
  - Wireshark dissector, protocol documentation, TimeSync/Broadcast services
  - https://github.com/Jaxc/PyStageLinQ

- **StageLinq fork** by kyleawayan
  - Track path resolution fix, disconnect freezing fix
  - https://github.com/kyleawayan/StageLinq

## [2.0.0-Beta] - Previous Release

Instance-based API refactor with dual API pattern. See git history for details.

## [1.0.9] and earlier

See git history for changes in 1.x releases.
