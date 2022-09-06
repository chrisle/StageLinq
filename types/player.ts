
export interface PlayerStatus {
  address: string;
  artist: string;
  currentBpm: number
  deck: string;
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

  source: string;
  trackPath: string;
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
}
