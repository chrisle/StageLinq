# Change log

## v3.0.3

- fix: add contents write permission for git push


## v3.0.2

- fix: handle yarn.lock and improve changelog generation
- ci: auto-version bump and publish on push to main
- docs: update prolink-connect reference to alphatheta-connect
- chore: update package-lock.json
- fix: resolve TypeScript strict mode type errors
- chore: update TypeScript configuration
- fix: properly close UDP socket when stopping StageLinq listener
- chore: update dependencies for better performance
- chore: regenerate package-lock.json
- docs: add related packages section to README
- chore: remove GitHub Actions, publish locally via 1Password


## v3.0.1

- fix: handle null return from execSync in release script
- chore: change license to MIT
- chore: trigger CI
- fix: correct 1Password secret path for npm token
- Add release script for automated npm publishing
- Use 1Password for NPM token in publish workflow
- feat: subscribe to all 4 mixer channel faders
- feat: add networkTap option for packet debugging
- chore: update dependencies and lockfile
- ci: add GitHub Actions for automated testing and npm publishing
- test: add database module tests
- chore: update dependencies for Node 22 compatibility
- docs: update test count to 193 tests
- test: add comprehensive unit tests for all modules
- chore: remove stale prototype patch file
- chore: bump version to 3.0.0
- revert: restore CHANGELOG to 2.0.0 format
- chore: bump version to 3.0.0
- docs: add comprehensive service documentation
- docs: add comprehensive events documentation with state data reference
- docs: add feature comparison matrix to README
- docs: update README with features, examples, and contributors
- feat: add unit test suite and prepare for npm publishing
- feat: add Wireshark dissector, protocol docs, track path fix, and connection health
- feat: add EAAS support, Windows broadcast fix, token utilities, and CLI tools
- feat: add BeatInfo, TimeSync, Broadcast services and dual API pattern
- Include dist
- Upgrade sqlite3
- Support typescript in library
- Add dist to gitignore
- Remove dist
- Bump version
- Handle when announce timer hasn't started
- Bump version
- Ignore log.txt
- Add option to disable FileTransfer
- Add compiled dist.
- reuseAddr for UDP socket bindings
- Add debug msg for Service.disconnect()
- Handle Shutdown msg (0x9) from FileTransfer svc
- Check ftx availability for DownloadDB
- Also release block if error
- FileTransfer.getFile() blocks until complete
- Bump version
- Temporary roll back sending timestamp message until further testing.
- File service needs to be setup even without db
- New song stage change needs both
- Remove album art code
- Refactor CLI.
- Move type to another directory
- Refine when to fire trackLoaded
- Return only one result
- Refactor connection out of downloadDatabase.
- Fix typos.
- Add explanation.
- Bump version
- Use events only if db option enabled.
- Throw exception when no data sources have been downloaded.
- Add additional logging
- Code style
- Bump version
- At least one device.
- Reply to TimeStamp Messages
- Increase the update rate
- Fix issue with song loading
- Bump version
- Clean up and restore file download in CLI
- Move connected event
- Clean up comments
- Fix race condition loading track on 2nd player.
- POC made of POS code to handle race condition
- Added notes about ip/port vs token here.
- Bump version
- Possible hack to get metadata from streaming files
- Bump version
- Handle streaming files
- Add track's absolute path
- Bump verison
- Update pkacage description
- Update readme
- Update readme
- Update docs
- Download and read databases
- Add file transfer progress
- Add new tokens.
- Decrease update refresh time
- Allow the option to download and use db.
- Tell me which one is failing.
- Add ability to get data from DB
- There! Remove dist!
- get rid of dist
- Exclude dist from git
- Clean up
- Add debug info
- Increase download time to 60 seconds.
- Update dist
- Updating prettier settings
- Moved constant location
- Fix possible undefined data types.
- Fix data type for CLI
- Refactor client token
- Ignore SoundSwitchEmbedded Discovery Messages
- Download database.
- Update readme
- Pass along messages up to the main class.
- Doc changes
- Show connection in CLI
- Emit all the things
- Clean up CLI example
- Pushed log to an emitter.
- Change log labels
- Fix connection, change stuff to Logger
- Export Stagelinq
- Package and dist
- Ignore soundswitch and resolume.
- Documentation update
- Update readme doc
- More documentation.
- Documentation for Player
- Added some comments.
- Support for multiple players and layers.
- Handle multiple Denon devices on the network.
- Changes to make it easier to consume as library.
- Update FileTransfer.ts
- support for v2 only db sources
- ADD: as proposed by @honusz we need a wait at these placed to increase stability
- ADD: check if there are any broadcast ips
- FIX: No need for await to be there
- FIX: Broadcast announcement to all network interfaces
- FIX: Send the Service request AFTER I'm allowed too.
- Wait for serviceRequestAllowed signal received from device, before we poll the device.
- CHG: Handle null checking in getSourceAndTrackFromNetworkPath. CHG: if there is no album art return TrackLocalAlbumArtPath = {"string": "", "type":-1}, not {"string": null, "type":-1}
- Update README.md
- Skip album art lookup in case no track loaded to deck
- Bind socket to a random port and setBroadcast to true when initializing the UDP socket used for announcing oneself.
- Added npm start command and TypeScript compile as pre-start routine
- ADD: --disableFileTransfer commandline option FIX: Correctly handle no album-art case
- ADD: prettier to package.json
- DEL: Unused import
- CHG: Set default EOL behavior to LF
- ADD: prettier config files CHG: prettified all sources (no code changes)
- CHG: Enabled skipSync again
- FIX: incorrect placement of "
- ADD: support for album art downloading ADD: when loading a new track onto a deck, a newly created TrackLocalAlbumArtPath now indicates where the album art can be found. E.g.,:
- CHG: Replaced with MAGIC_MARKER const
- CHG: Do FileTransfer before StateMap. Somehow StateMap becomes confused if we do FileTransfer afterwards. Not sure why (yet) FIX: Reset this.receivedFile at end of getFile() DEL: Removed some debug prints
- CHG: FileTransfer is now able to retrieve the source database and display its number of album arts using SQLite.
- ADD: FileTransfer service WIP ADD: Services are now created through a factory method connectToService in Controller.ts ADD: Message event handling
- ADD: readUInt8
- ADD: hex helper (based on https://www.npmjs.com/package/hex)
- CHG: Contexts use big endian by default CHG: connectToService returns service
- FIX: incorrect check for OfflineAnalyzer
- ADD: automatic watcher as described here: https://stackoverflow.com/questions/29996145/visual-studio-code-compile-on-save/60374212#60374212
- Update README.md
- ADD: set internalConsoleOptions to openOnSessionStart when launching
- ADD: watcher task for background compilation
- Update README.md
- Update README.md
- CHG: Also output error during unannounce.
- CHG: 'OfflineAnalyzer', which is a Engine OS 2.0+ service, should be skipped
- CHG: Demoted info to log
- FIX: Also properly output interval
- ADD: Support for different 'smaa' messages (JSON or interval?)
- ADD: readInt32
- FIX: resolve doesn't exit the while-loop, so break as well ADD: display all services
- Update README.md

# Changelog

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
