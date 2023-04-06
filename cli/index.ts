import { ActingAsDevice, StageLinqOptions, ServiceList, Source } from '../types';
import { DeviceId } from '../devices'
import { StateData, StateMap, BeatData, BeatInfo, FileTransfer } from '../services';
import { sleep } from '../utils/sleep';
import { StageLinq } from '../StageLinq';
import { Logger } from '../LogEmitter';
import * as fs from 'fs';
import * as os from 'os';
import * as Path from 'path';

require('console-stamp')(console, {
  format: ':date(HH:MM:ss) :label',
});

function progressBar(size: number, bytes: number, total: number): string {
  const progress = Math.ceil((bytes / total) * 10)
  let progressArrary = new Array<string>(size);
  progressArrary.fill(' ');
  if (progress) {
    for (let i = 0; i < progress; i++) {
      progressArrary[i] = '|'
    }
  }
  return `[${progressArrary.join('')}]`
}

async function getTrackInfo(sourceName: string, deviceId: DeviceId, trackName: string) {
  while (!StageLinq.sources.hasSourceAndDB(sourceName, deviceId)) {
    await sleep(1000);
  }
  try {
    const source = StageLinq.sources.getSource(sourceName, deviceId);
    const connection = source.database.local.connection;
    const result = await connection.getTrackInfo(trackName);
    return result;
  } catch (e) {
    console.error(e);
  }
}

async function downloadFile(sourceName: string, deviceId: DeviceId, path: string, dest?: string) {
  while (!StageLinq.sources.hasSource(sourceName, deviceId)) {
    await sleep(250)
  }
  try {
    const source = StageLinq.sources.getSource(sourceName, deviceId);
    const data = await StageLinq.sources.downloadFile(source, path);
    if (dest && data) {
      const filePath = `${dest}/${path.split('/').pop()}`
      fs.writeFileSync(filePath, Buffer.from(data));
    }
  } catch (e) {
    console.error(`Could not download ${path}`);
    console.error(e)
  }
}


async function main() {

  console.log('Starting CLI');

  const stageLinqOptions: StageLinqOptions = {
    downloadDbSources: true,
    actingAs: ActingAsDevice.StageLinqJS,
    services: [
      ServiceList.StateMap,
      ServiceList.FileTransfer,
      ServiceList.BeatInfo,
    ],
  }

  const stageLinq = await new StageLinq(stageLinqOptions);

  stageLinq.logger.on('error', (...args: any) => {
    console.error(...args);
  });
  stageLinq.logger.on('warn', (...args: any) => {
    console.warn(...args);
    args.push("\n");
  });
  stageLinq.logger.on('info', (...args: any) => {
    console.info(...args);
    args.push("\n");
  });
  stageLinq.logger.on('log', (...args: any) => {
    console.log(...args);
    args.push("\n");
  });
  // stageLinq.logger.on('debug', (...args: any) => {
  //   console.debug(...args);
  //   args.push("\n");
  // });
  //Note: Silly is very verbose!
  // stageLinq.logger.on('silly', (...args: any) => {
  //   console.debug(...args);
  // });


  StageLinq.discovery.on('listening', () => {
    console.log(`[DISCOVERY] Listening`)
  });

  StageLinq.discovery.on('announcing', (info) => {
    console.log(`[DISCOVERY] Broadcasting Announce ${info.deviceId.string} Port ${info.port} ${info.source} ${info.software.name}:${info.software.version}`)
  });

  StageLinq.discovery.on('newDiscoveryDevice', (info) => {
    console.log(`[DISCOVERY] New Device ${info.deviceId.string} ${info.source} ${info.software.name} ${info.software.version}`)
  });

  StageLinq.discovery.on('updatedDiscoveryDevice', (info) => {
    console.log(`[DISCOVERY] Updated Device ${info.deviceId.string} Port:${info.port} ${info.source} ${info.software.name} ${info.software.version}`)
  });


  StageLinq.devices.on('newDevice', (device) => {
    Logger.debug(`[DEVICES] New Device ${device.deviceId.string}`)
  });

  StageLinq.devices.on('newService', (device, service) => {
    console.log(`[DEVICES] New ${service.name} Service on ${device.deviceId.string} port ${service.serverInfo.port}`)
  });


  if (stageLinqOptions.services.includes(ServiceList.StateMap)) {

    async function deckIsMaster(data: StateData) {
      if (data.json.state) {
        const deck = parseInt(data.name.substring(12, 13))
        await sleep(250);
        const track = StageLinq.status.getTrack(data.deviceId, deck)
        console.log(`Now Playing: `, track)
      }
    }

    async function songLoaded(data: StateData) {
      if (data.json.state) {
        const deck = parseInt(data.name.substring(12, 13))
        await sleep(250);
        const track = StageLinq.status.getTrack(data.deviceId, deck)
        console.log(`[STATUS] Track Loaded: `, track)

        if (stageLinqOptions.services.includes(ServiceList.FileTransfer) && StageLinq.options.downloadDbSources) {
          const trackInfo = await getTrackInfo(track.source.name, track.source.location, track.TrackNetworkPath);
          console.log('[STATUS] Track DB Info: ', trackInfo)
          downloadFile(track.source.name, track.source.location, track.source.path, Path.resolve(os.tmpdir()));
        }
      }
    }

    StateMap.emitter.on('newDevice', async (service: StateMap) => {
      console.log(`[STATEMAP] Subscribing to States on ${service.deviceId.string}`);

      for (let i = 1; i <= service.device.deckCount(); i++) {
        service.addListener(`/Engine/Deck${i}/DeckIsMaster`, deckIsMaster);
        service.addListener(`/Engine/Deck${i}/Track/SongLoaded`, songLoaded);
      }

      service.subscribe();
    });

    StateMap.emitter.on('stateMessage', async (data: StateData) => {
      console.log(`[STATEMAP] ${data.deviceId.string} ${data.name} => ${JSON.stringify(data.json)}`);
    });

  }


  if (stageLinqOptions.services.includes(ServiceList.FileTransfer)) {


    FileTransfer.emitter.on('fileTransferProgress', (source, file, txid, progress) => {
      console.log(`[FILETRANSFER] ${source.name} id:{${txid}} Reading ${file}: ${progressBar(10, progress.bytesDownloaded, progress.total)} (${Math.ceil(progress.percentComplete)}%)`);
    });

    FileTransfer.emitter.on('fileTransferComplete', (source, file, txid) => {
      console.log(`[FILETRANSFER] Complete ${source.name} id:{${txid}} ${file}`);
    });

    StageLinq.sources.on('newSource', (source: Source) => {
      console.log(`[SOURCES] Source Available: (${source.name})`);
    });

    StageLinq.sources.on('dbDownloaded', (source: Source) => {
      console.log(`[SOURCES] Database Downloaded: (${source.name})`);
    });

    StageLinq.sources.on('sourceRemoved', (sourceName: string, deviceId: DeviceId) => {
      console.log(`[SOURCES] Source Removed: ${sourceName} on ${deviceId.string}`);
    });

  }


  if (stageLinqOptions.services.includes(ServiceList.BeatInfo)) {

    //  User Options
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
    function beatCallback(bd: BeatData,) {
      let deckBeatString = ""
      for (let i = 0; i < bd.deckCount; i++) {
        deckBeatString += `Deck: ${i + 1} Beat: ${bd.deck[i].beat.toFixed(3)}/${bd.deck[i].totalBeats.toFixed(0)} `
      }
      console.log(`[BEATINFO] ${bd.deviceId.string} clock: ${bd.clock} ${deckBeatString}`);
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

    BeatInfo.emitter.on('newDevice', async (beatInfo: BeatInfo) => {
      console.log(`[BEATINFO] New Device ${beatInfo.deviceId.string}`)

      if (beatMethod.useCallback) {
        beatInfo.startBeatInfo(beatOptions, beatCallback);
      }

      if (beatMethod.useEvent) {
        beatInfo.startBeatInfo(beatOptions);
        BeatInfo.emitter.on('beatMessage', (bd) => {

          if (bd) {
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
  }


  /////////////////////////////////////////////////////////////////////////
  // CLI

  let returnCode = 0;
  try {
    process.on('SIGINT', async function () {
      console.info('... exiting');

      try {
        await stageLinq.disconnect();
      } catch (err: any) {
        const message = err.stack.toString();
        console.error(message);
      }
      process.exit(returnCode);
    });

    await stageLinq.connect();

    while (true) {
      await sleep(250);
    }

  } catch (err: any) {
    const message = err.stack.toString();
    console.error(message);
    returnCode = 1;
  }

  await stageLinq.disconnect();
  process.exit(returnCode);
}

main();
