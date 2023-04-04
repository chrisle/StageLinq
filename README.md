# StageLinqJS  - A Robust Implementation of StageLinq Library

## Description
This branch implements the methods demonstrated previously in the StageLinq Listener branch.
Rather than searching out devices via discovery, we are able to have devices initiate connections to the library. As demonstrated, this approach:
* Greatly reduces complexity. 

* Speeds up the connection & initialization process (almost every sleep() call has been eliminated without and affect thus far).

* Handles disconnection and reconnection of devices gracefully and simply.

* Allows connections from devices we couldn't use previously (i.e. x1800/x1850 mixers).

## Implementing Selected Services
We can choose which services to implement by including them in the `StageLinqOptions` parameter passed to Stagelinq on initialization. 
```ts 
const stageLinqOptions: StageLinqOptions = {
  downloadDbSources: false,
  maxRetries: 3,
  actingAs: ActingAsDevice.StageLinqJS,
  services: [
    ServiceList.StateMap,
    ServiceList.BeatInfo,
    ServiceList.FileTransfer,
  ],
}
```


## Discovery

```ts
stageLinq.discovery.on('listening', () => {
  console.log(`[DISCOVERY] Listening`)
});

stageLinq.discovery.on('announcing', (info) => {
  console.log(`[DISCOVERY] Broadcasting Announce ${info.deviceId.string} Port ${info.port} ${info.source} ${info.software.name}:${info.software.version}`)
});

stageLinq.discovery.on('newDiscoveryDevice', (info) => {
  console.log(`[DISCOVERY] New Device ${info.deviceId.string} ${info.source} ${info.software.name} ${info.software.version}`)
});

stageLinq.discovery.on('updatedDiscoveryDevice', (info) => {
  console.log(`[DISCOVERY] Updated Device ${info.deviceId.string} Port:${info.port} ${info.source} ${info.software.name} ${info.software.version}`)
});
  ```



## StateMap
```ts
stageLinq.stateMap.on('newDevice', (service: StateMapDevice) => {
    console.log(`[STATEMAP] Subscribing to States on ${service.deviceId.string}`);
    service.subscribe();
});

stageLinq.stateMap.on('stateMessage', async (data: ServiceMessage<StateData>) => {
    console.log(`[STATEMAP] ${data.deviceId.string} ${data.message.name} => ${JSON.stringify(data.message.json)}`);
  });
```

### Using NowPlaying-type updates from StageLinq.status

```ts
async function deckIsMaster(data: ServiceMessage<StateData>) {
  if (data.message.json.state) {
    const deck = parseInt(data.message.name.substring(12, 13))
    await sleep(250);
    const track = stageLinq.status.getTrack(data.deviceId, deck)
    console.log(`Now Playing: `, track)
  }
}

async function songLoaded(data: ServiceMessage<StateData>) {
  if (data.message.json.state) {
    const deck = parseInt(data.message.name.substring(12, 13))
    await sleep(250);
    const track = stageLinq.status.getTrack(data.deviceId, deck)
    console.log(`Track Loaded: `, track)
    if (stageLinq.fileTransfer && stageLinq.options.downloadDbSources) {
      const split = track.TrackNetworkPath.substring(6).split('/')
      const deviceId = new DeviceId(split.shift());
      const sourceName = split.shift();
      const path = `/${sourceName}/${split.join('/')}`
      
      const trackInfo = await getTrackInfo(stageLinq, sourceName, deviceId, track.TrackNetworkPath);
      console.log('Track DB Info: ', trackInfo)
      downloadFile(stageLinq, sourceName, deviceId, path, Path.resolve(os.tmpdir()));
    }
  }
}

stageLinq.stateMap.on('newDevice', async (service: StateMapDevice) => {
  console.log(`[STATEMAP] Subscribing to States on ${service.deviceId.string}`);

  const info = stageLinq.discovery.getConnectionInfo(service.deviceId)
  for (let i = 1; i <= info.device.decks; i++) {
    await stageLinq.status.addTrack(service, i);
    service.addListener(`/Engine/Deck${i}/DeckIsMaster`, deckIsMaster);
    service.addListener(`/Engine/Deck${i}/Track/SongLoaded`, songLoaded);
  }

  service.subscribe();
});
```

## FileTransfer & Databases

```ts
stageLinq.fileTransfer.on('fileTransferProgress', (source, file, txid, progress) => {
  console.log(`[FILETRANSFER] ${source.name} id:{${txid}} Reading ${file}: ${progressBar(10, progress.bytesDownloaded, progress.total)} (${Math.ceil(progress.percentComplete)}%)`);
});

stageLinq.fileTransfer.on('fileTransferComplete', (source, file, txid) => {
  console.log(`[FILETRANSFER] Complete ${source.name} id:{${txid}} ${file}`);
});

stageLinq.fileTransfer.on('newSource', (source: Source) => {
  console.log(`[FILETRANSFER] Source Available: (${source.name})`);
});

stageLinq.fileTransfer.on('sourceRemoved', (sourceName: string, deviceId: DeviceId) => {
  console.log(`[FILETRANSFER] Source Removed: ${sourceName} on ${deviceId.string}`);
});

stageLinq.databases.on('dbDownloaded', (source: Source) => {
  console.log(`[FILETRANSFER] Database Downloaded: (${source.name})`);
});
```
## BeatInfo
```ts
const beatOptions = {
  // Resolution for triggering callback
  //    0 = every message WARNING, it's a lot!
  //    1 = every beat 
  //    4 = every 4 beats 
  //    .25 = every 1/4 beat
  everyNBeats: 1,
}

//  User callback function. 
//  Will be triggered everytime a player's beat counter crosses the resolution threshold
function beatCallback(bd: ServiceMessage<BeatData>,) {
  let deckBeatString = ""
  for (let i = 0; i < bd.message.deckCount; i++) {
    deckBeatString += `Deck: ${i + 1} Beat: ${bd.message.deck[i].beat.toFixed(3)}/${bd.message.deck[i].totalBeats.toFixed(0)} `
  }
  console.log(`[BEATINFO] ${bd.deviceId.string} clock: ${bd.message.clock} ${deckBeatString}`);
}

////  callback is optional, BeatInfo messages can be consumed by: 
//      - user callback
//      - event messages 
//      - reading the register 
const beatMethod = {
  useCallback: true,
  useEvent: false,
  useRegister: false,
};


stageLinq.beatInfo.on('newBeatInfoDevice', async (beatInfo: BeatInfo) => {
  console.log(`[BEATINFO] New Device ${beatInfo.deviceId.string}`)


  if (beatMethod.useCallback) {
    beatInfo.startBeatInfo(beatOptions, beatCallback);
  }

  if (beatMethod.useEvent) {
    beatInfo.startBeatInfo(beatOptions);
    stageLinq.beatInfo.on('beatMsg', (bd) => {
      if (bd.message) {
        beatCallback(bd);
      }
    });
  }

  if (beatMethod.useRegister) {
    beatInfo.startBeatInfo(beatOptions);

    function beatFunc(beatInfo: BeatInfo) {
      const beatData = beatInfo.getBeatData();
      if (beatData) beatCallback(beatData);
    }

    setTimeout(beatFunc, 4000, beatInfo)
  }

})

```


## Additional Notes on the Listener Method

* The Directory service is the only one which is *required* as it is the initial connection endpoint for remote devices.

* Only tokens of a specific structure seem to work, otherwise devices won't initiate a connection. One requirement *seems* to be that they start with `0xFFFFFFFFFFFF`, but some more research into this is needed.