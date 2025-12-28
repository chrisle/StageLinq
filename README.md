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

| Feature | Description |
|---------|-------------|
| Device Discovery | Auto-discover StageLinq devices on the network |
| StateMap Service | Track state, fader positions, device status |
| BeatInfo Service | Real-time BPM, beat grid, timeline position |
| FileTransfer Service | Download databases and files from devices |
| TimeSync Service | Synchronize timing with devices |
| Broadcast Service | Broadcast messages to network |
| EAAS Support | Engine Library access via gRPC/HTTP |
| Connection Health | Automatic reconnection on connection loss |
| Windows Support | Per-interface broadcast for Windows compatibility |
| Track Path Resolution | Handle files outside Engine Library/Music |

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

### Device Events

```ts
stagelinq.devices.on('ready', (info: ConnectionInfo) => {});
stagelinq.devices.on('newDevice', (device: Device) => {});
stagelinq.devices.on('deviceConnected', (info: ConnectionInfo) => {});
stagelinq.devices.on('deviceDisconnected', (info: ConnectionInfo) => {});
```

### Track Events

```ts
stagelinq.devices.on('trackLoaded', (status: PlayerStatus) => {});
stagelinq.devices.on('nowPlaying', (status: PlayerStatus) => {});
stagelinq.devices.on('trackUnloaded', (deck: DeckInfo) => {});
```

### State Events

```ts
stagelinq.devices.on('stateChanged', (state: StateData) => {});
stagelinq.devices.on('stateMessage', (data: StateData) => {});
```

### Database Events

```ts
stagelinq.devices.on('newSource', (source: SourceInfo) => {});
stagelinq.devices.on('dbDownloading', (sourceId, dbPath) => {});
stagelinq.devices.on('dbDownloaded', (sourceId, dbPath) => {});
```

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

## Documentation

- [Protocol Documentation](docs/protocol.md) - StageLinq protocol specification
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

## License

GPL-3.0
