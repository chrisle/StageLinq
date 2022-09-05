# StageLinq

NodeJS library implementation to access information through the Denon StageLinq protocol.

# Features

* Tested with Denon two SC6000, Prime 4, Prime 2, and Prime Go
* Event emitter for state changes, track loading, and current playing track.
* Event emitter for debug logging.

## Example

```ts
import { StageLinq } from 'StageLinq';

async function main() {
  const stageLinq = new StageLinq();

  // Print the logging output to the console.
  stageLinq.logger.on('error', (...args: any) => { console.error(...args); });
  stageLinq.logger.on('warn', (...args: any) => { console.warn(...args); });
  stageLinq.logger.on('info', (...args: any) => { console.info(...args); });
  stageLinq.logger.on('log', (...args: any) => { console.log(...args); });
  stageLinq.logger.on('debug', (...args: any) => { console.debug(...args); });
  stageLinq.logger.on('silly', (...args: any) => { console.debug(...args); });

  // Fires when a new track is loaded into a device.
  stageLinq.devices.on('trackLoaded', (status) => {
    console.log(`New track loaded on to deck ${status.deck}`, status);
  });

  // Fires when the state of the device changes.
  stageLinq.devices.on('stateChanged', (status) => {
    console.log(`State of ${status.deck} changed`, status);
  });

  // Fires when a new track is playing.
  stageLinq.devices.on('nowPlaying', (status) => {
    console.log(`Now playing on ${status.deck}`, status);
  })

  await stageLinq.connect();

  // Loop forever
  const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
  };
  while(true) { sleep(250); }
}
```

## Example Output of CLI

```
[22:38:52] [LOG] Starting CLI
[22:38:52] [INFO] Announced myself
[22:38:52] [LOG] Connecting to JP13 on 192.168.86.202:37861
[22:38:52] [DEBUG] Attempting to connect to 192.168.86.202:37861
[22:38:52] [LOG] TCP connection to '192.168.86.202:37861' local port: 64530
[22:38:53] [ERROR] DN-X1800/DN-X1850 not yet supported
[22:38:53] [LOG] Connecting to JP13 on 192.168.86.201:43209
[22:38:53] [DEBUG] Attempting to connect to 192.168.86.201:43209
[22:38:53] [LOG] TCP connection to '192.168.86.201:43209' local port: 64544
[22:38:53] [INFO] Discovered the following services on 192.168.86.202:37861
[22:38:53] [INFO]       port: 40855 => StateMap
[22:38:53] [INFO]       port: 42283 => Broadcast
[22:38:53] [INFO]       port: 44973 => Syncing
[22:38:53] [INFO]       port: 35331 => TimeSynchronization
[22:38:53] [INFO]       port: 38005 => BeatInfo
[22:38:53] [INFO]       port: 36333 => FileTransfer
[22:38:53] [INFO] Discovered the following services on 192.168.86.201:43209
[22:38:53] [INFO]       port: 40793 => StateMap
[22:38:53] [INFO]       port: 37885 => Broadcast
[22:38:53] [INFO]       port: 44413 => Syncing
[22:38:53] [INFO]       port: 34061 => TimeSynchronization
[22:38:53] [INFO]       port: 38321 => BeatInfo
[22:38:53] [INFO]       port: 34159 => FileTransfer
[22:38:53] [LOG] TCP connection to '192.168.86.202:40855' local port: 64560
[22:38:53] [INFO] Connected to service 'StateMap' at port 40855
[22:38:53] [LOG] Successfully connected to 192.168.86.202:37861
[22:38:53] [LOG] /Engine/Deck1/Play => {"state":false,"type":1}
[22:38:53] [LOG] /Engine/Deck1/PlayState => {"state":false,"type":1}
[22:38:53] [LOG] /Engine/Deck1/Track/ArtistName => {"string":"Luminary","type":8}
[22:38:53] [LOG] /Engine/Deck1/Track/TrackNetworkPath => {"string":"net://8fba5ced-9381-4d5c-b334-5bf935b8e49e/SC6000 (Internal)/Engine Library/Music/Luminary/Anjunabeats Pres_ Super8 and Tab 01/3409891_amsterdam_super8___tab_remix.mp3","type":8}
[22:38:53] [LOG] /Engine/Deck1/Track/SongLoaded => {"state":true,"type":1}
[22:38:53] [LOG] /Engine/Deck1/Track/SongName => {"string":"Amsterdam (Super8 & Tab Remix)","type":8}
[22:38:53] [LOG] /Engine/Deck1/Track/TrackData => {"state":true,"type":3}
[22:38:53] [LOG] /Engine/Deck1/Track/TrackName => {"string":"net://8fba5ced-9381-4d5c-b334-5bf935b8e49e/SC6000 (Internal)/Engine Library/Music/Luminary/Anjunabeats Pres_ Super8 and Tab 01/3409891_amsterdam_super8___tab_remix.mp3","type":8}
[22:38:53] [LOG] /Engine/Deck1/CurrentBPM => {"type":0,"value":143.2281494140625}
[22:38:53] [LOG] /Engine/Deck1/ExternalMixerVolume => {"type":0,"value":0}
[22:38:53] [LOG] /Engine/Deck2/Play => {"state":false,"type":1}
[22:38:53] [LOG] /Engine/Deck2/PlayState => {"state":false,"type":1}
[22:38:53] [LOG] /Engine/Deck2/Track/ArtistName => {"string":"Shogun","type":8}
[22:38:53] [LOG] /Engine/Deck2/Track/TrackNetworkPath => {"string":"net://8fba5ced-9381-4d5c-b334-5bf935b8e49e/SC6000 (Internal)/Engine Library/Music/Shogun/Armin Van Buuren Presents 100 Armind Tunes/03 skyfire (original mix).mp3","type":8}
[22:38:53] [LOG] /Engine/Deck2/Track/SongLoaded => {"state":true,"type":1}
[22:38:53] [LOG] /Engine/Deck2/Track/SongName => {"string":"Skyfire (Original Mix)","type":8}
[22:38:53] [LOG] /Engine/Deck2/Track/TrackData => {"state":true,"type":3}
[22:38:53] [LOG] /Engine/Deck2/Track/TrackName => {"string":"net://8fba5ced-9381-4d5c-b334-5bf935b8e49e/SC6000 (Internal)/Engine Library/Music/Shogun/Armin Van Buuren Presents 100 Armind Tunes/03 skyfire (original mix).mp3","type":8}
[22:38:53] [LOG] /Engine/Deck2/CurrentBPM => {"type":0,"value":143.2281494140625}
[22:38:53] [LOG] /Engine/Deck2/ExternalMixerVolume => {"type":0,"value":0}
[22:38:53] [LOG] /Client/Preferences/Player => {"string":"2","type":4}
[22:38:53] [LOG] /Client/Preferences/PlayerJogColorA => {"color":"#ff1cd2e5","type":16}
[22:38:53] [LOG] /Client/Preferences/PlayerJogColorB => {"color":"#ffea2828","type":16}
[22:38:53] [LOG] /Engine/Master/MasterTempo => {"type":0,"value":143.2281494140625}
[22:38:53] [LOG] /Engine/Sync/Network/MasterStatus => {"state":false,"type":1}
[22:38:54] [LOG] TCP connection to '192.168.86.201:40793' local port: 64567
[22:38:54] [INFO] Connected to service 'StateMap' at port 40793
[22:38:54] [LOG] Successfully connected to 192.168.86.201:43209
[22:38:54] [LOG] /Engine/Deck1/Play => {"state":false,"type":1}
[22:38:54] [LOG] /Engine/Deck1/PlayState => {"state":false,"type":1}
[22:38:54] [LOG] /Engine/Deck1/Track/ArtistName => {"string":"Solarstone","type":8}
[22:38:54] [LOG] /Engine/Deck1/Track/TrackNetworkPath => {"string":"net://8fba5ced-9381-4d5c-b334-5bf935b8e49e/SC6000 (Internal)/Engine Library/Music/Solarstone/Nothing But Chemistry Here/01 nothing but chemistry here (sean tyas rem.mp3","type":8}
[22:38:54] [LOG] /Engine/Deck1/Track/SongLoaded => {"state":true,"type":1}
[22:38:54] [LOG] /Engine/Deck1/Track/SongName => {"string":"Nothing But Chemistry Here (Sean Tyas Remix)","type":8}
[22:38:54] [LOG] /Engine/Deck1/Track/TrackData => {"state":true,"type":3}
[22:38:54] [LOG] /Engine/Deck1/Track/TrackName => {"string":"/media/SC6000/Engine Library/Music/Solarstone/Nothing But Chemistry Here/01 nothing but chemistry here (sean tyas rem.mp3","type":8}
[22:38:54] [LOG] /Engine/Deck1/CurrentBPM => {"type":0,"value":143.2281494140625}
[22:38:54] [LOG] /Engine/Deck1/ExternalMixerVolume => {"type":0,"value":0.9900000095367432}
[22:38:54] [LOG] /Engine/Deck2/Play => {"state":false,"type":1}
[22:38:54] [LOG] /Engine/Deck2/PlayState => {"state":false,"type":1}
[22:38:54] [LOG] /Engine/Deck2/Track/ArtistName => {"string":"Giuseppe Ottaviani","type":8}
[22:38:54] [LOG] /Engine/Deck2/Track/TrackNetworkPath => {"string":"net://8fba5ced-9381-4d5c-b334-5bf935b8e49e/SC6000 (Internal)/Engine Library/Music/Giuseppe Ottaviani/15 Years of Vandit The Best Of/09 linking people (original mix).mp3","type":8}
[22:38:54] [LOG] /Engine/Deck2/Track/SongLoaded => {"state":true,"type":1}
[22:38:54] [LOG] /Engine/Deck2/Track/SongName => {"string":"Linking People (Original Mix)","type":8}
[22:38:54] [LOG] /Engine/Deck2/Track/TrackData => {"state":true,"type":3}
[22:38:54] [LOG] /Engine/Deck2/Track/TrackName => {"string":"/media/SC6000/Engine Library/Music/Giuseppe Ottaviani/15 Years of Vandit The Best Of/09 linking people (original mix).mp3","type":8}
[22:38:54] [LOG] /Engine/Deck2/CurrentBPM => {"type":0,"value":143.2281494140625}
[22:38:54] [LOG] /Engine/Deck2/ExternalMixerVolume => {"type":0,"value":0}
[22:38:54] [LOG] /Client/Preferences/Player => {"string":"1","type":4}
[22:38:54] [LOG] /Client/Preferences/PlayerJogColorA => {"color":"#ffea2828","type":16}
[22:38:54] [LOG] /Client/Preferences/PlayerJogColorB => {"color":"#ff1cd2e5","type":16}
[22:38:54] [LOG] /Engine/Master/MasterTempo => {"type":0,"value":143.2281494140625}
[22:38:54] [LOG] /Engine/Sync/Network/MasterStatus => {"state":true,"type":1}
[22:38:55] [ERROR] Ignoring NowPlaying
[22:38:55] [LOG] New track loaded: {
  deck: '2A',
  player: 2,
  layer: 'A',
  address: '192.168.86.202',
  port: 37861,
  masterTempo: 143.2281494140625,
  masterStatus: false,
  play: false,
  playState: false,
  artist: 'Luminary',
  trackNetworkPath: 'net://8fba5ced-9381-4d5c-b334-5bf935b8e49e/SC6000 (Internal)/Engine Library/Music/Luminary/Anjunabeats Pres_ Super8 and Tab 01/3409891_amsterdam_super8___tab_remix.mp3',
  songLoaded: true,
  title: 'Amsterdam (Super8 & Tab Remix)',
  hasTrackData: true,
  fileLocation: 'net://8fba5ced-9381-4d5c-b334-5bf935b8e49e/SC6000 (Internal)/Engine Library/Music/Luminary/Anjunabeats Pres_ Super8 and Tab 01/3409891_amsterdam_super8___tab_remix.mp3',
  currentBpm: 143.2281494140625,
  externalMixerVolume: 0,
  jogColor: '#ff1cd2e5'
}
[22:38:55] [LOG] New track loaded: {
  deck: '2B',
  player: 2,
  layer: 'B',
  address: '192.168.86.202',
  port: 37861,
  masterTempo: 143.2281494140625,
  masterStatus: false,
  play: false,
  playState: false,
  artist: 'Shogun',
  trackNetworkPath: 'net://8fba5ced-9381-4d5c-b334-5bf935b8e49e/SC6000 (Internal)/Engine Library/Music/Shogun/Armin Van Buuren Presents 100 Armind Tunes/03 skyfire (original mix).mp3',
  songLoaded: true,
  title: 'Skyfire (Original Mix)',
  hasTrackData: true,
  fileLocation: 'net://8fba5ced-9381-4d5c-b334-5bf935b8e49e/SC6000 (Internal)/Engine Library/Music/Shogun/Armin Van Buuren Presents 100 Armind Tunes/03 skyfire (original mix).mp3',
  currentBpm: 143.2281494140625,
  externalMixerVolume: 0,
  jogColor: '#ffea2828'
}
[22:38:56] [LOG] New track loaded: {
  deck: '1A',
  player: 1,
  layer: 'A',
  address: '192.168.86.201',
  port: 43209,
  masterTempo: 143.2281494140625,
  masterStatus: true,
  play: false,
  playState: false,
  artist: 'Solarstone',
  trackNetworkPath: 'net://8fba5ced-9381-4d5c-b334-5bf935b8e49e/SC6000 (Internal)/Engine Library/Music/Solarstone/Nothing But Chemistry Here/01 nothing but chemistry here (sean tyas rem.mp3',
  songLoaded: true,
  title: 'Nothing But Chemistry Here (Sean Tyas Remix)',
  hasTrackData: true,
  fileLocation: '/media/SC6000/Engine Library/Music/Solarstone/Nothing But Chemistry Here/01 nothing but chemistry here (sean tyas rem.mp3',
  currentBpm: 143.2281494140625,
  externalMixerVolume: 0.9900000095367432,
  jogColor: '#ffea2828'
}
[22:38:56] [LOG] New track loaded: {
  deck: '1B',
  player: 1,
  layer: 'B',
  address: '192.168.86.201',
  port: 43209,
  masterTempo: 143.2281494140625,
  masterStatus: true,
  play: false,
  playState: false,
  artist: 'Giuseppe Ottaviani',
  trackNetworkPath: 'net://8fba5ced-9381-4d5c-b334-5bf935b8e49e/SC6000 (Internal)/Engine Library/Music/Giuseppe Ottaviani/15 Years of Vandit The Best Of/09 linking people (original mix).mp3',
  songLoaded: true,
  title: 'Linking People (Original Mix)',
  hasTrackData: true,
  fileLocation: '/media/SC6000/Engine Library/Music/Giuseppe Ottaviani/15 Years of Vandit The Best Of/09 linking people (original mix).mp3',
  currentBpm: 143.2281494140625,
  externalMixerVolume: 0,
  jogColor: '#ff1cd2e5'
}
[22:39:00] [LOG] /Engine/Deck2/PlayState => {"state":true,"type":1}
[22:39:00] [LOG] /Engine/Deck2/Play => {"state":true,"type":1}
[22:39:00] [LOG] /Engine/Deck2/CurrentBPM => {"type":0,"value":143.2281494140625}
[22:39:00] [LOG] /Engine/Master/MasterTempo => {"type":0,"value":143.2281494140625}
[22:39:02] [LOG] Now Playing on [1B]: Linking People (Original Mix) - Giuseppe Ottaviani
[22:39:05] [LOG] /Engine/Deck1/PlayState => {"state":true,"type":1}
[22:39:05] [LOG] /Engine/Deck1/Play => {"state":true,"type":1}
[22:39:07] [LOG] Now Playing on [2A]: Amsterdam (Super8 & Tab Remix) - Luminary

```

---


## About

Forked from @MarByteBeep's code.

Additional reverse engineering work: https://github.com/chrisle/stagelinq-pcap

Used in my app Now Playing https://www.nowplaying2.com
