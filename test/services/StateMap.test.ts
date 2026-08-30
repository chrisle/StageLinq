import { describe, it, expect } from 'vitest';
import { States } from '../../services/StateMap';
import { StageLinqValue } from '../../types';

/**
 * Engine OS exposes roughly 115 states per deck; we ask for 15 of them. These
 * tests pin both halves of that decision — what we subscribe to, and what we
 * deliberately leave alone — so neither drifts by accident.
 */
describe('StateMap subscription allowlist', () => {
  const DECKS = [1, 2, 3, 4] as const;

  it('asks every deck for the same states', () => {
    const perDeck = DECKS.map((n) => States.filter((s) => s.startsWith(`/Engine/Deck${n}/`)).length);

    expect(perDeck).toEqual([15, 15, 15, 15]);
  });

  it('subscribes to the track metadata that has somewhere to go', () => {
    // Each of these lands in a RawTrack field: genre, key, duration and the
    // streaming source. A state we do not ask for is never sent.
    for (const n of DECKS) {
      expect(States).toContain(StageLinqValue[`EngineDeck${n}TrackGenre`]);
      expect(States).toContain(StageLinqValue[`EngineDeck${n}TrackCurrentKey`]);
      expect(States).toContain(StageLinqValue[`EngineDeck${n}TrackTrackLength`]);
      expect(States).toContain(StageLinqValue[`EngineDeck${n}TrackTrackURI`]);
    }
  });

  it('leaves the high-frequency transport states alone', () => {
    // These fire every few milliseconds while a deck plays and tell a
    // now-playing consumer nothing. Subscribing to them would flood the state
    // channel for no gain.
    const noisy = [
      'PlayPosition',
      'TrackPosition',
      'SongPosition',
      'PlayheadPosition',
      'Scratching',
      'SlipModePosition',
      'CurrentLoopInPosition',
      'CurrentLoopOutPosition',
    ];

    for (const state of States) {
      for (const name of noisy) {
        expect(state.endsWith(`/${name}`)).toBe(false);
      }
    }
  });

  it('has no duplicate subscriptions', () => {
    expect(new Set(States).size).toBe(States.length);
  });
});
