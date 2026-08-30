
export interface PlayerStatus {
  address: string;
  artist: string;
  currentBpm: number
  deck: string;
  deviceId: string;
  externalMixerVolume: number;
  fileLocation: string;
  hasTrackData: boolean;
  jogColor: string;
  layer: string;
  masterStatus: boolean;
  masterTempo: number;
  play: boolean;
  player: number;
  playState: boolean;
  port: number;
  songLoaded: boolean;
  title: string;
  trackNetworkPath: string;

  /** Genre as tagged on the track. */
  genre: string;
  /** Musical key as Engine displays it, e.g. 'Am' or '8A'. */
  key: string;
  /** Track duration in seconds. */
  trackLength: number;
  /**
   * Engine's own URI for the track. For streaming tracks this names the
   * service, which is the only place a Denon player says which one it is.
   */
  trackUri: string;

  source: string;
  dbSourceName: string;
  trackPath: string;
  trackPathAbsolute: string;
}

export interface PlayerLayerState {
  layer: string;
  artist?: string;
  currentBpm?: number;
  externalMixerVolume?: number;
  fileLocation?: string;
  hasTrackData?: boolean;
  jogColor?: string;
  play?: boolean;
  player?: string;
  playState?: boolean;
  songLoaded?: boolean;
  title?: string;
  trackNetworkPath?: string;
  genre?: string;
  key?: string;
  trackLength?: number;
  trackUri?: string;
}
