import { describe, it, expect } from 'vitest';
import { ReadContext } from '../../utils/ReadContext';

// Test the BeatInfo message parsing logic without network dependencies
describe('BeatInfo message parsing', () => {
  /**
   * Helper to write float64 in big endian to a DataView
   */
  function writeFloat64BE(view: DataView, offset: number, value: number): number {
    view.setFloat64(offset, value, false);
    return 8;
  }

  /**
   * Creates a mock BeatInfo message buffer.
   * Format: id (4) + clock (8) + deckCount (4) + deckData (deckCount * 24) + samples (deckCount * 8)
   */
  function createBeatInfoMessage(options: {
    id?: number;
    clock?: bigint;
    deckCount?: number;
    decks?: Array<{ beat: number; totalBeats: number; bpm: number; samples?: number }>;
  }): ArrayBuffer {
    const id = options.id ?? 1;
    const clock = options.clock ?? 0n;
    const deckCount = options.deckCount ?? options.decks?.length ?? 2;
    const decks = options.decks ?? [
      { beat: 1.0, totalBeats: 100.0, bpm: 128.0 },
      { beat: 2.0, totalBeats: 200.0, bpm: 140.0 },
    ];

    // Calculate buffer size: 4 (id) + 8 (clock) + 4 (deckCount) + deckCount * 24 (deck data) + deckCount * 8 (samples)
    const size = 4 + 8 + 4 + deckCount * 24 + deckCount * 8;
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);
    let offset = 0;

    // Write id (big endian)
    view.setUint32(offset, id, false);
    offset += 4;

    // Write clock (big endian)
    view.setBigUint64(offset, clock, false);
    offset += 8;

    // Write deckCount (big endian)
    view.setUint32(offset, deckCount, false);
    offset += 4;

    // Write deck data (beat, totalBeats, bpm as float64)
    for (let i = 0; i < deckCount; i++) {
      const deck = decks[i] || { beat: 0, totalBeats: 0, bpm: 0 };
      offset += writeFloat64BE(view, offset, deck.beat);
      offset += writeFloat64BE(view, offset, deck.totalBeats);
      offset += writeFloat64BE(view, offset, deck.bpm);
    }

    // Write sample positions
    for (let i = 0; i < deckCount; i++) {
      const deck = decks[i] || { samples: 0 };
      offset += writeFloat64BE(view, offset, deck.samples ?? 0);
    }

    return buffer;
  }

  describe('parseData', () => {
    it('parses basic beat info message', () => {
      const buffer = createBeatInfoMessage({
        id: 1,
        clock: 12345n,
        decks: [
          { beat: 1.5, totalBeats: 256.0, bpm: 128.0, samples: 44100 },
          { beat: 3.25, totalBeats: 512.0, bpm: 140.0, samples: 88200 },
        ],
      });

      const ctx = new ReadContext(buffer, false);

      // Read and verify the parsed data
      const id = ctx.readUInt32();
      const clock = ctx.readUInt64();
      const deckCount = ctx.readUInt32();

      expect(id).toBe(1);
      expect(clock).toBe(12345n);
      expect(deckCount).toBe(2);

      // Read deck data
      const deck1Beat = ctx.readFloat64();
      const deck1TotalBeats = ctx.readFloat64();
      const deck1Bpm = ctx.readFloat64();

      expect(deck1Beat).toBe(1.5);
      expect(deck1TotalBeats).toBe(256.0);
      expect(deck1Bpm).toBe(128.0);

      const deck2Beat = ctx.readFloat64();
      const deck2TotalBeats = ctx.readFloat64();
      const deck2Bpm = ctx.readFloat64();

      expect(deck2Beat).toBe(3.25);
      expect(deck2TotalBeats).toBe(512.0);
      expect(deck2Bpm).toBe(140.0);

      // Read samples
      expect(ctx.readFloat64()).toBe(44100);
      expect(ctx.readFloat64()).toBe(88200);
    });

    it('handles single deck message', () => {
      const buffer = createBeatInfoMessage({
        deckCount: 1,
        decks: [{ beat: 1.0, totalBeats: 100.0, bpm: 120.0 }],
      });

      const ctx = new ReadContext(buffer, false);
      ctx.readUInt32(); // id
      ctx.readUInt64(); // clock
      const deckCount = ctx.readUInt32();

      expect(deckCount).toBe(1);
    });

    it('handles four deck message', () => {
      const buffer = createBeatInfoMessage({
        deckCount: 4,
        decks: [
          { beat: 1.0, totalBeats: 100.0, bpm: 120.0 },
          { beat: 2.0, totalBeats: 200.0, bpm: 125.0 },
          { beat: 3.0, totalBeats: 300.0, bpm: 130.0 },
          { beat: 4.0, totalBeats: 400.0, bpm: 135.0 },
        ],
      });

      const ctx = new ReadContext(buffer, false);
      ctx.readUInt32(); // id
      ctx.readUInt64(); // clock
      const deckCount = ctx.readUInt32();

      expect(deckCount).toBe(4);

      // Verify all 4 decks can be read
      for (let i = 0; i < 4; i++) {
        const beat = ctx.readFloat64();
        const totalBeats = ctx.readFloat64();
        const bpm = ctx.readFloat64();

        expect(beat).toBe(i + 1);
        expect(totalBeats).toBe((i + 1) * 100);
        expect(bpm).toBe(120 + i * 5);
      }
    });

    it('handles zero values', () => {
      const buffer = createBeatInfoMessage({
        decks: [{ beat: 0, totalBeats: 0, bpm: 0, samples: 0 }],
        deckCount: 1,
      });

      const ctx = new ReadContext(buffer, false);
      ctx.readUInt32(); // id
      ctx.readUInt64(); // clock
      ctx.readUInt32(); // deckCount

      expect(ctx.readFloat64()).toBe(0); // beat
      expect(ctx.readFloat64()).toBe(0); // totalBeats
      expect(ctx.readFloat64()).toBe(0); // bpm
    });

    it('handles high BPM values', () => {
      const buffer = createBeatInfoMessage({
        deckCount: 1,
        decks: [{ beat: 1.0, totalBeats: 100.0, bpm: 200.0 }],
      });

      const ctx = new ReadContext(buffer, false);
      ctx.readUInt32();
      ctx.readUInt64();
      ctx.readUInt32();
      ctx.readFloat64(); // beat
      ctx.readFloat64(); // totalBeats
      const bpm = ctx.readFloat64();

      expect(bpm).toBe(200.0);
    });

    it('handles large clock values', () => {
      const buffer = createBeatInfoMessage({
        clock: 9876543210123456789n,
        deckCount: 1,
        decks: [{ beat: 1.0, totalBeats: 100.0, bpm: 128.0 }],
      });

      const ctx = new ReadContext(buffer, false);
      ctx.readUInt32();
      const clock = ctx.readUInt64();

      expect(clock).toBe(9876543210123456789n);
    });
  });
});
