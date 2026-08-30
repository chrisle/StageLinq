# StateMap Service

The StateMap service provides real-time state tracking for DJ decks, including track information, playback state, fader positions, and more.

## Usage

```ts
import { StageLinq } from 'stagelinq';

const stagelinq = new StageLinq();

stagelinq.devices.on('stateChanged', (state) => {
  console.log(`${state.name}: ${state.value}`);
});

stagelinq.devices.on('stateMessage', (data) => {
  // Raw state message
});

// Listen to specific state paths
stagelinq.devices.on('/Engine/Deck1/CurrentBPM', (bpm) => {
  console.log(`Deck 1 BPM: ${bpm}`);
});

await stagelinq.connect();
```

## State Categories

### Track Information

| State | Type | Description |
|-------|------|-------------|
| `ArtistName` | string | Track artist |
| `SongName` | string | Track title |
| `TrackName` | string | Full track name |
| `Genre` | string | Genre |
| `TrackLength` | number | Duration in seconds |
| `TrackNetworkPath` | string | Network path to track |
| `TrackUri` | string | Track URI |

There is no `Label`, `AlbumName` or `Comment` state. Earlier revisions of this
table listed all three; none has ever existed in any Engine build. Verified
against the Engine OS 5.0.4 SC6000 firmware and Engine DJ desktop 5.0.0: the
only `Label` paths under a deck prefix are `AutoLoopLabel%2` and
`BeatJump/BeatJumpLabel%2`, which are loop-button UI text. The device does hold
a track's record label — `Track.label` in the Engine library database — it just
never publishes it over StageLinQ (NP3-364).

### Playback State

| State | Type | Description |
|-------|------|-------------|
| `Play` | boolean | Is playing |
| `PlayState` | number | Play state enum |
| `CurrentBPM` | number | Current BPM |
| `Speed` | number | Playback speed (1.0 = normal) |
| `SpeedRange` | number | Pitch range setting |

### Sync & Master

| State | Type | Description |
|-------|------|-------------|
| `SyncMode` | number | Sync mode (off/beat/bar) |
| `DeckIsMaster` | boolean | Is tempo master |
| `MasterTempo` | number | Master tempo BPM |

### Key & Pitch

| State | Type | Description |
|-------|------|-------------|
| `CurrentKey` | string | Musical key as Engine displays it |
| `CurrentKeyIndex` | number | Musical key index |
| `KeyLock` | boolean | Key lock enabled |

`CurrentKey` is the one to read. `CurrentKeyIndex` is a position in Engine's own
key ordering, and that ordering is not documented anywhere — turning it back
into a key name means guessing a mapping, and a wrong key is worse than no key
for anything that matches tracks against a catalogue.

### Loop

| State | Type | Description |
|-------|------|-------------|
| `LoopEnableState` | boolean | Loop active |
| `CurrentLoopInPosition` | number | Loop in point |
| `CurrentLoopOutPosition` | number | Loop out point |
| `CurrentLoopSizeInBeats` | number | Loop size in beats |

### Cue Points

| State | Type | Description |
|-------|------|-------------|
| `CuePosition` | number | Main cue position |
| `HotCue1` - `HotCue8` | object | Hot cue data |

### Mixer

| State | Type | Description |
|-------|------|-------------|
| `ExternalMixerVolume` | number | Channel fader (0-1) |
| `CrossfaderPosition` | number | Crossfader position |

## What this library subscribes to

Engine OS publishes roughly 115 states per deck, but a device only sends the
ones you ask for. `States` in `services/StateMap.ts` is the allowlist, and it is
deliberately small — 15 states per deck:

| Purpose | States |
|---------|--------|
| Transport | `Play`, `PlayState`, `PlayStatePath` |
| Track identity | `Track/SongLoaded`, `Track/SongName`, `Track/ArtistName`, `Track/TrackName`, `Track/TrackData`, `Track/TrackNetworkPath` |
| Track metadata | `Track/Genre`, `Track/CurrentKey`, `Track/TrackLength`, `Track/TrackUri` |
| Mixing | `CurrentBPM`, `ExternalMixerVolume` |

Plus, once per device: the channel faders and crossfader, the channel
assignments, `Client/Preferences/*`, `Client/Deck{1,2}/DeckIsMaster`,
`Engine/Master/MasterTempo` and `Engine/Sync/Network/MasterStatus`.

### Deliberately not subscribed to

Most of what is left out is high-frequency transport data. `PlayPosition`,
`TrackPosition`, `SongPosition`, `PlayheadPosition`, `Scratching`,
`SlipModePosition`, the waveform-view states and the loop-region and quick-cue
families all update every few milliseconds while a deck plays, and none of them
says anything about *what* is playing. Subscribing to them would flood the state
channel to no purpose.

The rest are metadata states that exist but have nowhere to go: `Rating`,
`SampleRate`, `FileName`, `AlbumArtPath`, `MetaDataBPM`, `OriginalKey`,
`CurrentKeyCents`. Adding a subscription is cheap — `subscribeState` is a single
fire-and-forget write, and a state the firmware does not publish simply never
arrives — but a state nothing reads is still noise on the wire. Subscribe
deliberately, not exhaustively.

## State Path Format

States are organized by deck:

```
/Engine/Deck1/CurrentBPM
/Engine/Deck2/CurrentBPM
/Engine/Deck3/CurrentBPM
/Engine/Deck4/CurrentBPM
```

Mixer states use a different path:

```
/Mixer/CrossfaderPosition
/Mixer/ChannelFader1
```

## Full State List

See [events.md](events.md#full-state-list) for the complete list of 200+ states.
