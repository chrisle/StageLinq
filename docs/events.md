# StageLinq Events

Complete list of events emitted by the StageLinq library.

## Discovery Events

```ts
stagelinq.on('listening', () => {});
stagelinq.on('announcing', (info: AnnounceInfo) => {});
stagelinq.on('newDiscoveryDevice', (info: ConnectionInfo) => {});
stagelinq.on('updatedDiscoveryDevice', (info: ConnectionInfo) => {});
```

## Device Events

```ts
stagelinq.devices.on('newDevice', (device: Device) => {});
stagelinq.devices.on('deviceConnected', (info: ConnectionInfo) => {});
stagelinq.devices.on('deviceDisconnected', (info: ConnectionInfo) => {});
stagelinq.devices.on('ready', (info: ConnectionInfo) => {});
```

## Service Events

```ts
stagelinq.devices.on('newService', (device: Device, service: Service) => {});
```

## Track Events

```ts
stagelinq.devices.on('trackLoaded', (status: PlayerStatus) => {});
stagelinq.devices.on('nowPlaying', (status: PlayerStatus) => {});
stagelinq.devices.on('trackUnloaded', (deck: DeckInfo) => {});
```

### PlayerStatus

```ts
interface PlayerStatus {
  deck: string;           // 'A', 'B', 'C', 'D'
  title: string;
  artist: string;
  album: string;
  genre: string;
  label: string;
  key: string;
  bpm: number;
  duration: number;
  trackPath: string;
  trackNetworkPath: string;
  artwork?: string;
}
```

## State Events

```ts
stagelinq.devices.on('stateChanged', (state: StateData) => {});
stagelinq.devices.on('stateMessage', (data: StateData) => {});

// Also emits by state path, e.g.:
stagelinq.devices.on('/Engine/Deck1/Play', (value: any) => {});
stagelinq.devices.on('/Engine/Deck1/CurrentBPM', (value: number) => {});
```

### Common State Paths

| Category | State Paths |
|----------|-------------|
| **Track Info** | `/Engine/Deck1/ArtistName`, `/Engine/Deck1/SongName`, `/Engine/Deck1/TrackName`, `/Engine/Deck1/TrackURI`, `/Engine/Deck1/TrackNetworkPath`, `/Engine/Deck1/TrackLength` |
| **Playback** | `/Engine/Deck1/Play`, `/Engine/Deck1/PlayState`, `/Engine/Deck1/CurrentBPM`, `/Engine/Deck1/Speed`, `/Engine/Deck1/SpeedRange` |
| **Sync** | `/Engine/Deck1/SyncMode`, `/Engine/Deck1/DeckIsMaster`, `/Engine/Deck1/MasterTempo` |
| **Key** | `/Engine/Deck1/CurrentKeyIndex`, `/Engine/Deck1/KeyLock` |
| **Loop** | `/Engine/Deck1/LoopEnableState`, `/Engine/Deck1/CurrentLoopInPosition`, `/Engine/Deck1/CurrentLoopOutPosition`, `/Engine/Deck1/CurrentLoopSizeInBeats` |
| **Cue** | `/Engine/Deck1/CuePosition` |
| **Mixer** | `/Engine/Deck1/ExternalMixerVolume`, `/Mixer/CrossfaderPosition` |

*Replace `Deck1` with `Deck2`, `Deck3`, `Deck4` for other decks.*

## Beat Events (BeatInfo Service)

```ts
stagelinq.devices.on('beatMessage', (data: BeatData) => {});
```

### BeatData

```ts
interface BeatData {
  deck: number;           // 0-3
  beat: number;           // Current beat in bar (1-4)
  totalBeats: number;     // Total beats played
  bpm: number;            // Current BPM
  timeline: number;       // Timeline position in seconds
}
```

## Database Events

```ts
stagelinq.devices.on('newSource', (source: SourceInfo) => {});
stagelinq.devices.on('dbDownloading', (sourceId: string, dbPath: string) => {});
stagelinq.devices.on('dbProgress', (sourceId: string, total: number, downloaded: number, percent: number) => {});
stagelinq.devices.on('dbDownloaded', (sourceId: string, dbPath: string) => {});
```

### SourceInfo

```ts
interface SourceInfo {
  name: string;           // e.g., 'USB 1', '(Internal)'
  path: string;           // Network path to source
}
```

## File Transfer Events

```ts
stagelinq.devices.on('fileMessage', (data: FileTransferData) => {});
stagelinq.devices.on('fileTransferProgress', (source: string, fileName: string, txid: number, progress: Progress) => {});
stagelinq.devices.on('fileTransferComplete', (source: string, fileName: string, txid: number) => {});
```

## Broadcast Events

```ts
stagelinq.devices.on('broadcastMessage', (deviceId: string, key: string, value: any) => {});
```

## Connection Events

```ts
stagelinq.on('connected', () => {});
stagelinq.on('disconnected', () => {});
stagelinq.on('error', (error: Error) => {});
stagelinq.on('message', (info: ConnectionInfo, data: Buffer) => {});
```

## Logging Events

```ts
stagelinq.on('log', (...args: any[]) => {});
stagelinq.on('error', (...args: any[]) => {});
stagelinq.on('warn', (...args: any[]) => {});
stagelinq.on('info', (...args: any[]) => {});
stagelinq.on('debug', (...args: any[]) => {});
```

## Connection Health Events

```ts
const health = new ConnectionHealth(options);

health.on('healthy', () => {});
health.on('unhealthy', (status: ConnectionStatus) => {});
health.on('stale', () => {});
health.on('reconnecting', (attempt: number) => {});
health.on('reconnected', () => {});
health.on('reconnectFailed', () => {});
```

## Full State List

The library tracks ~200+ state values per deck. See [protocol.md](protocol.md) for the complete protocol specification.

### Track States
- `ArtistName`, `SongName`, `TrackName`, `AlbumName`
- `TrackURI`, `TrackNetworkPath`, `TrackLength`, `TrackBytes`
- `Genre`, `Label`, `Comment`, `Rating`

### Playback States
- `Play`, `PlayState`, `PlayStatePath`
- `CurrentBPM`, `Speed`, `SpeedRange`, `SpeedState`
- `PadsView`, `PerformanceView`

### Sync States
- `SyncMode`, `SyncPlayState`
- `DeckIsMaster`, `MasterTempo`

### Key States
- `CurrentKeyIndex`, `KeyLock`

### Loop States
- `LoopEnableState`, `LoopIsActive`
- `CurrentLoopInPosition`, `CurrentLoopOutPosition`
- `CurrentLoopSizeInBeats`
- `QuickLoop1` through `QuickLoop8`

### Cue States
- `CuePosition`
- `HotCue1` through `HotCue8`

### Deck States
- `Color`, `ActiveDeck`
- `ExternalMixerVolume`, `ExternalScratchWheelTouch`
- `DeckCount`

### Waveform States
- `SongAnalyzed`, `SampleRate`
- `TrackData`, `WaveformData`

### Device States
- `HasSDCardConnected`, `HasUsbDeviceConnected`
- `LayerA`, `LayerB`
- `PlayerJogColorA`, `PlayerJogColorB`
- `PlayerColor1` through `PlayerColor4`
