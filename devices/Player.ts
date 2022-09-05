import { EventEmitter } from 'events';
import { PlayerLayerState, PlayerStatus, ServiceMessage } from '../types';
import { PlayerMessageQueue } from './PlayerMessageQueue';
import { StateData, StateMap } from '../services';

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

  player: number;           // Player number as reported by the device.
  address: string;          // IP address
  port: number;             // Port
  masterTempo: number;      // Current master tempo BPM
  masterStatus: boolean;    // If this device has the matser tempo

  private decks: Map<string, PlayerLayerState> = new Map();
  private queue: {[layer: string]: PlayerMessageQueue} = {};

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
      : (/Track\/TrackNetworkPath$/.test(name)) ? { trackNetworkPath: json.string }
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
    } else {
      throw new Error(`I don't know what this message is: ${name}`)
    }
  }

  /**
   * Emit PlayerStatus up to the main StageLinq class.
   * @param data
   */
  private handleUpdate(data: PlayerLayerState) {
    const layer = data.layer;
    const newSongLoaded = data.hasOwnProperty('songLoaded');

    // If a new song is loaded drop all the previous track data.
    if (newSongLoaded) {
      this.decks.set(layer, data);
    } else {
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
      ...result
    };

    if (newSongLoaded) {
      this.emit('trackLoaded', output as PlayerStatus);
    }

    if (result.playState) {
      this.emit('nowPlaying', output as PlayerStatus);
    }

    this.emit('stateChanged', output as PlayerStatus);
  }

  private deckNumberToLayer(deck: string) {
    const index = parseInt(deck.replace('Deck', '')) - 1;
    return 'ABCD'[index];
  }

}