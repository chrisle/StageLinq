# BeatInfo Service

The BeatInfo service provides real-time beat and tempo information from DJ decks, useful for visualizations and beat-synced effects.

## Usage

```ts
import { StageLinq } from 'stagelinq';

const stagelinq = new StageLinq();

stagelinq.devices.on('beatMessage', (data) => {
  console.log(`Deck ${data.deck}: Beat ${data.beat}/4 at ${data.bpm} BPM`);
});

await stagelinq.connect();
```

## BeatData Interface

```ts
interface BeatData {
  deck: number;        // Deck index (0-3)
  beat: number;        // Current beat in bar (1-4)
  totalBeats: number;  // Total beats since track start
  bpm: number;         // Current BPM
  timeline: number;    // Timeline position in seconds
}
```

## Example: Beat Visualizer

```ts
import { StageLinq } from 'stagelinq';

const stagelinq = new StageLinq();
const deckNames = ['A', 'B', 'C', 'D'];

stagelinq.devices.on('beatMessage', (data) => {
  const bar = Math.floor(data.totalBeats / 4) + 1;
  const beat = (data.totalBeats % 4) + 1;

  console.log(
    `Deck ${deckNames[data.deck]}: ` +
    `Bar ${bar}, Beat ${beat} | ` +
    `${data.bpm.toFixed(1)} BPM | ` +
    `${formatTime(data.timeline)}`
  );
});

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

await stagelinq.connect();
```

## Example: Beat-synced Effects

```ts
stagelinq.devices.on('beatMessage', (data) => {
  // Flash on every beat
  if (data.beat === 1) {
    triggerFlash('downbeat');
  } else {
    triggerFlash('beat');
  }

  // Change color every 4 bars
  if (data.totalBeats % 16 === 0) {
    cycleColor();
  }
});
```

## CLI Demo

```bash
npx ts-node cli/beatinfo.ts
```

Output:
```
Deck A: Beat 1/4 | 128.0 BPM | 0:32
Deck A: Beat 2/4 | 128.0 BPM | 0:32
Deck A: Beat 3/4 | 128.0 BPM | 0:33
Deck A: Beat 4/4 | 128.0 BPM | 0:33
```

## Attribution

BeatInfo service ported from [go-stagelinq](https://github.com/icedream/go-stagelinq) by icedream.
