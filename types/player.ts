
export interface PlayerStatus {
  deck: string;
  player: number;
  layer: string;
  masterTempo: number;
  masterStatus: boolean;
  play: boolean;
  playState: boolean;
  artist: string;
  trackNetworkPath: string;
  songLoaded: boolean;
  title: string;
  hasTrackData: boolean;
  fileLocation: string;
  currentBpm: number
  externalMixerVolume: number;
  jogColor: string;
  address: string;
  port: number;
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
