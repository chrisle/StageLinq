import { EventEmitter } from 'events';
import { PlayerLayerState, PlayerStatus, ServiceMessage } from '../types';
import { PlayerMessageQueue } from './PlayerMessageQueue';
import { StateData, StateMap } from '../services';
import { Logger } from '../LogEmitter';

export declare interface Player {
  on(event: 'trackLoaded', listener: (status: PlayerStatus) => void): this;
  on(event: 'stateChanged', listener: (status: PlayerStatus) => void): this;
  on(event: 'nowPlaying', listener: (status: PlayerStatus) => void): this;
}

//////////////////////////////////////////////////////////////////////////////

interface PlayerOptions {
  stateMap: StateMap;
  address: string,
  port: number;
  deviceId: string;
}

interface SourceAndTrackPath {
  source: string;
  trackPath: string;
  trackPathAbsolute: string;
}

/**
 * A player represents a device on the StageLinq network.
 *
 * A player on the network may have up to 4 decks (or "layers" as they're
 * called on the harware). A player may also be given a player number.
 *
 * If you're using a Denon Prime Go/2/4 then you should only get one number.
 * If you're using a Denon SC5000/SC6000 then you assign the numbers in the
 * Denon's settings screen.
 *
 * Master tempo and master status only apply if you are using SC5000/SC6000
 * and if they're both on the network.
 *
 * A queue is used to group all the incoming messages from StageLinq to give us
 * a single updated PlayerStatus object.
 */
export class Player extends EventEmitter {

  private player: number;           // Player number as reported by the device.
  private address: string;          // IP address
  private port: number;             // Port
  private masterTempo: number;      // Current master tempo BPM
  private masterStatus: boolean;    // If this device has the matser tempo
  private decks: Map<string, PlayerLayerState> = new Map();
  private lastTrackNetworkPath: Map<string, string> = new Map();
  private queue: {[layer: string]: PlayerMessageQueue} = {};
  private deviceId: string;

  /**
   * Initialize a player device.
   *
   * @param networkDevice Network device
   * @param stateMap Statemap service
   */
  constructor(options: PlayerOptions) {
    super();
    options.stateMap.on('message', this.messageHandler.bind(this));
    this.address = options.address;
    this.port = options.port;
    this.deviceId = options.deviceId;
    this.queue = {
      A: new PlayerMessageQueue('A').onDataReady(this.handleUpdate.bind(this)),
      B: new PlayerMessageQueue('B').onDataReady(this.handleUpdate.bind(this)),
      C: new PlayerMessageQueue('C').onDataReady(this.handleUpdate.bind(this)),
      D: new PlayerMessageQueue('D').onDataReady(this.handleUpdate.bind(this)),
    };
  }

  /**
   * Parse the state data and push it into the update queue.
   *
   * @param data State data from Denon.
   * @returns
   */
  private messageHandler(data: ServiceMessage<StateData>) {
    const message = data.message
    if (!message.json) return;
    const name = message.name;
    const json = message.json as any;

    if (/Client\/Preferences\/Player$/.test(name)) {
      this.player = parseInt(json.string);
      return;
    }
    if (/Engine\/Master\/MasterTempo/.test(name)) {
      this.masterTempo = json.value;
      return;
    }
    if (/Engine\/Sync\/Network\/MasterStatus/.test(name)) {
      this.masterStatus = json.state;
      return;
    }

    const split = message.name.split('/');

    const deck =
      (/PlayerJogColor[A-D]$/.test(name)) ? split[3].replace('PlayerJogColor', '')
      : (/Engine\/Deck\d\//.test(name)) ? this.deckNumberToLayer(split[2])
      : null;

    const cueData =
        (/PlayState$/.test(name)) ? { playState: json.state }
      : (/Track\/TrackNetworkPath$/.test(name)) ? {
          trackNetworkPath: json.string,
          source: this.getSourceAndTrackPath(json.string).source,
          trackPath: this.getSourceAndTrackPath(json.string).trackPath,
          trackPathAbsolute: this.getSourceAndTrackPath(json.string).trackPathAbsolute
        }
      : (/Track\/SongLoaded$/.test(name)) ? { songLoaded: json.state }
      : (/Track\/SongName$/.test(name)) ? { title: json.string }
      : (/Track\/ArtistName$/.test(name)) ? { artist: json.string }
      : (/Track\/TrackData$/.test(name)) ? { hasTrackData: json.state }
      : (/Track\/TrackName$/.test(name)) ? { fileLocation: json.string }
      : (/CurrentBPM$/.test(name)) ? { currentBpm: json.value }
      : (/ExternalMixerVolume$/.test(name)) ? { externalMixerVolume: json.value }
      : (/Play$/.test(name)) ? { play: json.state }
      : (/PlayerJogColor[A-D]$/.test(name)) ? { jogColor: json.color }
      : null;

    if (cueData) {
      this.queue[deck].push({ layer: deck, ...cueData });
    }
  }

  /**
   * Update current state and emit.
   * @param data
   */
  private handleUpdate(data: PlayerLayerState) {
    Logger.debug(`data: ${JSON.stringify(data, null, 2)}`);

    const layer = data.layer;

    // A new song my be loading onto a layer but not yet fully downloaded.
    // For example streaming a song from Beatport Link.
    let isNewTrack = true;
    const lastTrackNetworkPath = this.lastTrackNetworkPath.get(layer);
    if (lastTrackNetworkPath && data.trackNetworkPath) {
      if (data.trackNetworkPath === lastTrackNetworkPath) {
        isNewTrack = false;
      }
    }
    this.lastTrackNetworkPath.set(layer, data.trackNetworkPath);

    // This will be true once a song has been fully downloaded / loaded.
    const isSongLoaded = data.hasOwnProperty('songLoaded');

    // If a new song is loaded drop all the previous track data.
    if (isNewTrack && isSongLoaded) {
      Logger.debug(`Replacing state ${layer}`);
      this.decks.set(layer, data);
    } else {
      Logger.debug(`Updating state ${layer}`);
      this.decks.set(layer, { ...this.decks.get(layer), ...data });
    }

    const result = this.decks.get(layer);
    const deck = `${this.player}${result.layer}`;

    const output = {
      deck: deck,
      player: this.player,
      layer: layer,
      address: this.address,
      port: this.port,
      masterTempo: this.masterTempo,
      masterStatus: this.masterStatus,
      deviceId: `net://${this.deviceId}`,
      ...result
    };

    // We're casting here because we originally built it up piecemeal.
    const currentState = output as PlayerStatus;

    if (currentState.trackNetworkPath && currentState.trackNetworkPath.startsWith('net:')) {
      const pathParts = currentState.trackNetworkPath.split('net://')[1].split('/', 2);
      currentState.dbSourceName = `net://${pathParts[0]}/${pathParts[1]}`;
      currentState.deviceId = `net://${pathParts[0]}`;
    } else if (!currentState.source || /Unknown/.test(currentState.source)) {
      // Tracks from streaming sources won't be in the database.
      currentState.dbSourceName = '';
    } else {
      currentState.dbSourceName = `net://${this.deviceId}/${currentState.source}`;
    }

    // If a song is loaded and we have a location emit the trackLoaded event.
    if (isSongLoaded && currentState.trackNetworkPath)
      this.emit('trackLoaded', currentState);

    // If the song is actually playing emit the nowPlaying event.
    if (result.playState) this.emit('nowPlaying', currentState);

    // Emit that the state has changed.
    this.emit('stateChanged', currentState);
  }

  private deckNumberToLayer(deck: string) {
    const index = parseInt(deck.replace('Deck', '')) - 1;
    return 'ABCD'[index];
  }

  private getSourceAndTrackPath(p_path: string): SourceAndTrackPath {
    if (!p_path || p_path.length === 0) return { source: '', trackPath: '', trackPathAbsolute: '' };
    const parts = p_path.split('/');
    const source = parts[3];
    let trackPath = parts.slice(5).join('/');

    // Handle streaming tracks.
    if (/\(Unknown\)/.test(source)) {
      return {
        source: source.replace(':', ''),
        trackPath: `streaming://${trackPath}`,
        trackPathAbsolute: `streaming://${trackPath}`
      }
    }

    if (parts[4] !== 'Engine Library') {
      // This probably occurs with RekordBox conversions; tracks are outside Engine Library folder
      trackPath = `../${parts[4]}/${trackPath}`;
    }

    return {
      source: source,
      trackPath: trackPath,
      trackPathAbsolute: `/${source}/Engine Library/${trackPath}`
    };
  }

}