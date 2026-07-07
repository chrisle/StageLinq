# BeatInfo Service

The BeatInfo service provides real-time beat and tempo information from DJ decks, useful for visualizations and beat-synced effects.

Not every device advertises the BeatInfo service. When a connected device does, its beat stream is surfaced through the `beatMessage` event; devices without it simply never emit the event.

## Usage

```ts
import { StageLinq, ActingAsDevice } from 'stagelinq';

StageLinq.options = { actingAs: ActingAsDevice.NowPlaying };

StageLinq.devices.on('beatMessage', (connectionInfo, data) => {
  data.decks.forEach((deck, i) => {
    console.log(`Deck ${i}: beat ${deck.beat.toFixed(2)} at ${deck.bpm.toFixed(1)} BPM`);
  });
});

await StageLinq.connect();
```

## BeatData Interface

Each `beatMessage` carries one `BeatData` snapshot covering **all** decks on the device (not one event per deck):

```ts
interface BeatData {
  clock: bigint;          // Device clock value for this update
  deckCount: number;      // Number of decks in `decks`
  decks: DeckBeatData[];  // Per-deck beat data (index = deck number)
}

interface DeckBeatData {
  beat: number;        // Current beat position within the track (fractional, counts up continuously)
  totalBeats: number;  // Total number of beats in the track
  bpm: number;         // Current BPM
  samples?: number;    // Sample position (if reported by the device)
}
```

Bar and beat-in-bar are derived from `beat`:

```ts
const bar        = Math.floor(deck.beat / 4) + 1;
const beatInBar  = Math.floor(deck.beat % 4) + 1;
```

## Emit Frequency

By default `beatMessage` fires on every update from the device. There is no configuration hook on the static `StageLinq` API today; if you only care about beat boundaries, throttle in your own handler by watching `Math.floor(deck.beat)` change.

## Example: Beat Visualizer

```ts
import { StageLinq, ActingAsDevice } from 'stagelinq';

const deckNames = ['A', 'B', 'C', 'D'];

StageLinq.options = { actingAs: ActingAsDevice.NowPlaying };

StageLinq.devices.on('beatMessage', (_connectionInfo, data) => {
  data.decks.forEach((deck, i) => {
    const bar = Math.floor(deck.beat / 4) + 1;
    const beatInBar = Math.floor(deck.beat % 4) + 1;

    console.log(
      `Deck ${deckNames[i]}: ` +
      `Bar ${bar}, Beat ${beatInBar} | ` +
      `${deck.bpm.toFixed(1)} BPM`
    );
  });
});

await StageLinq.connect();
```

## Example: Beat-synced Effects

```ts
const lastBeat: number[] = [];

StageLinq.devices.on('beatMessage', (_connectionInfo, data) => {
  data.decks.forEach((deck, i) => {
    const currentBeat = Math.floor(deck.beat);

    // Only fire once per whole beat.
    if (currentBeat === lastBeat[i]) return;
    lastBeat[i] = currentBeat;

    // Flash on the downbeat of each bar.
    if (currentBeat % 4 === 0) {
      triggerFlash('downbeat');
    } else {
      triggerFlash('beat');
    }

    // Change color every 4 bars.
    if (currentBeat % 16 === 0) {
      cycleColor();
    }
  });
});
```

## Attribution

BeatInfo service ported from [go-stagelinq](https://github.com/icedream/go-stagelinq) by icedream.
