# StageLinq

TypeScript library to connect to Denon DJ hardware via the StageLinq protocol.

## Installation

```bash
npm install stagelinq
```

## Quick Start

```ts
import { StageLinq } from 'stagelinq';

const stagelinq = new StageLinq({ downloadDbSources: true });

stagelinq.devices.on('trackLoaded', (status) => {
  console.log(`${status.title} - ${status.artist} loaded on deck ${status.deck}`);
});

stagelinq.devices.on('nowPlaying', (status) => {
  console.log(`Now Playing: ${status.title} - ${status.artist}`);
});

await stagelinq.connect();
```

## Features

| Feature | Go | Python | TS v2 |
|---------|:--:|:------:|:-----:|
| Device Discovery | ✅ | ✅ | ✅ |
| StateMap Service | ✅ | ✅ | ✅ |
| BeatInfo Service | ✅ | ❌ | ✅ |
| FileTransfer Service | ✅ | ❌ | ✅ |
| TimeSync Service | ✅ | ❌ | ✅ |
| Broadcast Service | ✅ | ❌ | ✅ |
| EAAS (gRPC library) | ✅ | ❌ | ✅ |
| EAAS (HTTP files) | ✅ | ❌ | ✅ |
| Windows Support | ✅ | ✅ | ✅ |
| macOS Support | ✅ | ❌ | ✅ |
| Linux Support | ✅ | ✅ | ✅ |
| Multi-interface discovery | ✅ | ✅ | ✅ |
| Database download | ✅ | ❌ | ✅ |
| Track path resolution | ❌ | ❌ | ✅ |
| Instance-based API | ✅ | ✅ | ✅ |
| Static class API | ❌ | ❌ | ✅ |
| CLI demo tools | ✅ | ✅ | ✅ |
| Wireshark dissector | ❌ | ✅ | ✅ |
| Unit tests | ✅ | ✅ | ✅ |

*Go = [go-stagelinq](https://github.com/icedream/go-stagelinq), Python = [PyStageLinQ](https://github.com/Jaxc/PyStageLinQ)*

## Supported Devices

- Denon SC6000 / SC6000M
- Denon SC5000 / SC5000M
- Denon Prime 4 / Prime 2 / Prime Go
- Denon X1850 / X1800 mixers
- Denon LC6000

## API

### Instance-based (recommended)

```ts
import { StageLinq } from 'stagelinq';

const stagelinq = new StageLinq({
  downloadDbSources: true,
  maxRetries: 3,
});

// Device events
stagelinq.devices.on('ready', (info) => {
  console.log(`Connected to ${info.software.name}`);
});

stagelinq.devices.on('trackLoaded', (status) => {
  console.log(`Loaded: ${status.title} on deck ${status.deck}`);
});

stagelinq.devices.on('nowPlaying', (status) => {
  console.log(`Playing: ${status.title}`);
});

// Database events
stagelinq.devices.on('dbDownloaded', (sourceId, dbPath) => {
  console.log(`Database saved to ${dbPath}`);
});

await stagelinq.connect();

// Later...
await stagelinq.disconnect();
```

### Static class

```ts
import { StageLinq } from 'stagelinq';

StageLinq.options = { downloadDbSources: true };

StageLinq.devices.on('nowPlaying', (status) => {
  console.log(`Playing: ${status.title}`);
});

await StageLinq.connect();
```

## Events

```ts
// Track events
stagelinq.devices.on('trackLoaded', (status: PlayerStatus) => {});
stagelinq.devices.on('nowPlaying', (status: PlayerStatus) => {});

// Device events
stagelinq.devices.on('ready', (info: ConnectionInfo) => {});
stagelinq.devices.on('deviceConnected', (info: ConnectionInfo) => {});

// State events (200+ states per deck)
stagelinq.devices.on('stateChanged', (state: StateData) => {});

// Beat events (real-time BPM, beat position)
stagelinq.devices.on('beatMessage', (data: BeatData) => {});

// Database events
stagelinq.devices.on('dbDownloaded', (sourceId, dbPath) => {});
```

**[View all events →](docs/events.md)**

## State Data

The library tracks 200+ state values per deck:

| Category | Example States |
|----------|----------------|
| **Track** | `ArtistName`, `SongName`, `TrackNetworkPath`, `TrackLength` |
| **Playback** | `Play`, `PlayState`, `CurrentBPM`, `Speed` |
| **Sync** | `SyncMode`, `DeckIsMaster`, `MasterTempo` |
| **Loop** | `LoopEnableState`, `CurrentLoopSizeInBeats` |
| **Mixer** | `ExternalMixerVolume`, `CrossfaderPosition` |

**[View all states →](docs/events.md#full-state-list)**

## Examples

See the [cli/](cli/) folder for complete examples:

- [`cli/index.ts`](cli/index.ts) - Full example with all events
- [`cli/discover.ts`](cli/discover.ts) - Network discovery demo
- [`cli/beatinfo.ts`](cli/beatinfo.ts) - Real-time beat information

Run examples:

```bash
# Main CLI
npx ts-node cli/index.ts

# Discovery
npx ts-node cli/discover.ts

# Beat info
npx ts-node cli/beatinfo.ts
```

## Tools

### Wireshark Dissector

A Lua dissector for Wireshark is included for protocol debugging:

```bash
# Copy to Wireshark plugins folder
cp tools/wireshark/stagelinq.lua ~/.local/lib/wireshark/plugins/
```

## Testing

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

**205 tests** across 14 test files.

## Documentation

### Guides
- [Events Reference](docs/events.md) - All events and state data
- [Protocol Specification](docs/protocol.md) - StageLinq protocol details

### Services
- [StateMap](docs/statemap.md) - Track state, playback, faders
- [BeatInfo](docs/beatinfo.md) - Real-time beat and tempo
- [FileTransfer](docs/filetransfer.md) - Database and file downloads
- [EAAS](docs/eaas.md) - Engine Library gRPC/HTTP access
- [Connection Health](docs/connection-health.md) - Auto-reconnection

### Reference
- [CHANGELOG](CHANGELOG.md) - Version history

## Contributors

- **Chris Le** ([@chrisle](https://github.com/chrisle)) - Maintainer
- **Martijn Reuvers** - Core development
- **MarByteBeep** ([@MarByteBeep](https://github.com/MarByteBeep)) - Original TypeScript implementation
- **honusz** - BeatInfo, TimeSync, Broadcast services
- **Kalle Kirjalainen** - Contributions
- **docBliny** - Contributions

## Attribution

This library incorporates code and ideas from other StageLinq implementations:

- **[go-stagelinq](https://github.com/icedream/go-stagelinq)** by Carl Kittelberger (icedream) - EAAS, Windows fix, token utilities
- **[PyStageLinQ](https://github.com/Jaxc/PyStageLinQ)** by Jaxc - Wireshark dissector, protocol documentation
- **[kyleawayan/StageLinq](https://github.com/kyleawayan/StageLinq)** by Kyle Awayan - Track path resolution fixes

## Related Packages

- [alphatheta-connect](https://github.com/chrisle/alphatheta-connect) — Pioneer Pro DJ Link integration
- [rekordbox-connect](https://github.com/chrisle/rekordbox-connect) — Rekordbox database integration
- [serato-connect](https://github.com/chrisle/serato-connect) — Serato DJ integration

These libraries power [Now Playing](https://nowplayingapp.com) — a real-time track display app for DJs and streamers.

## License

MIT
