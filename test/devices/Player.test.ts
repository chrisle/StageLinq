import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { Player } from '../../devices/Player';
import { UPDATE_RATE_MS } from '../../devices/PlayerMessageQueue';

/**
 * Helper to build a ServiceMessage<StateData> for the mock StateMap.
 */
function stateMsg(name: string, json: Record<string, unknown>) {
  return { id: 0, message: { name, json } };
}

describe('Player nowPlaying emission', () => {
  let stateMap: EventEmitter;
  let player: Player;
  let nowPlayingHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    stateMap = new EventEmitter();
    player = new Player({
      stateMap: stateMap as any,
      address: '192.168.1.1',
      port: 1234,
      deviceId: 'test-device',
    });
    nowPlayingHandler = vi.fn();
    player.on('nowPlaying', nowPlayingHandler);
  });

  afterEach(() => {
    vi.useRealTimers();
    player.removeAllListeners();
  });

  /**
   * Push state messages for loading a track onto Deck1 (layer A).
   */
  function loadTrack(trackPath = 'net://device/USB/Engine Library/Music/test.mp3') {
    stateMap.emit('message', stateMsg('/Engine/Deck1/Track/SongLoaded', { state: true }));
    stateMap.emit('message', stateMsg('/Engine/Deck1/Track/TrackNetworkPath', { string: trackPath }));
    stateMap.emit('message', stateMsg('/Engine/Deck1/Track/SongName', { string: 'Test Track' }));
    stateMap.emit('message', stateMsg('/Engine/Deck1/Track/ArtistName', { string: 'Test Artist' }));
  }

  function setPlayState(playing: boolean) {
    stateMap.emit('message', stateMsg('/Engine/Deck1/PlayState', { state: playing }));
  }

  it('fires when playState transitions false→true', () => {
    loadTrack();
    setPlayState(true);
    vi.advanceTimersByTime(UPDATE_RATE_MS);

    expect(nowPlayingHandler).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire on repeated state updates while playing', () => {
    // Load and start playing
    loadTrack();
    setPlayState(true);
    vi.advanceTimersByTime(UPDATE_RATE_MS);
    expect(nowPlayingHandler).toHaveBeenCalledTimes(1);

    // Send BPM update — should NOT re-fire nowPlaying
    stateMap.emit('message', stateMsg('/Engine/Deck1/CurrentBPM', { value: 128 }));
    vi.advanceTimersByTime(UPDATE_RATE_MS);

    // Send volume update — should NOT re-fire nowPlaying
    stateMap.emit('message', stateMsg('/Engine/Deck1/ExternalMixerVolume', { value: 0.8 }));
    vi.advanceTimersByTime(UPDATE_RATE_MS);

    expect(nowPlayingHandler).toHaveBeenCalledTimes(1);
  });

  it('fires when new track loads while already playing', () => {
    // Load first track and play
    loadTrack();
    setPlayState(true);
    vi.advanceTimersByTime(UPDATE_RATE_MS);
    expect(nowPlayingHandler).toHaveBeenCalledTimes(1);

    // Load a different track (hardware re-sends playState=true with new track load)
    loadTrack('net://device/USB/Engine Library/Music/different-track.mp3');
    setPlayState(true);
    vi.advanceTimersByTime(UPDATE_RATE_MS);

    expect(nowPlayingHandler).toHaveBeenCalledTimes(2);
  });

  it('does NOT fire when playState stays false', () => {
    // Load track but never set playState=true
    loadTrack();
    vi.advanceTimersByTime(UPDATE_RATE_MS);

    expect(nowPlayingHandler).not.toHaveBeenCalled();
  });
});
