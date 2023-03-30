import { ActingAsDevice, StageLinqOptions, ServiceList, ServiceMessage, Source } from '../types';
import { DeviceId } from '../devices'
import * as Services from '../services'
import { sleep } from '../utils/sleep';
import { StageLinq } from '../StageLinq';
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

async function getTrackInfo(stageLinq: StageLinq, sourceName: string, deviceId: DeviceId, trackName: string) {
  while (!stageLinq.sources.hasSourceAndDB(sourceName, deviceId)) {
    await sleep(1000);
  }
  try {
    const _source = stageLinq.sources.getSource(sourceName, deviceId);
    const connection = _source.database.connection;
    const result = await connection.getTrackInfo(trackName);
    console.log('Database entry:', result);
    return result;
  } catch (e) {
    console.error(e);
  }
}

async function downloadFile(stageLinq: StageLinq, sourceName: string, deviceId: DeviceId, path: string, dest?: string) {   
    while (!stageLinq.sources.hasSource(sourceName, deviceId)) {
      await sleep(250)
    }
    try {
        const _source = stageLinq.sources.getSource(sourceName, deviceId);
        const data = await stageLinq.sources.downloadFile(_source, path);
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
    maxRetries: 3,
    actingAs: ActingAsDevice.StageLinqJS,
    services: [
      ServiceList.StateMap,
      ServiceList.BeatInfo,
      ServiceList.FileTransfer,
      //ServiceList.TimeSynchronization, TODO Implement TimeSync Fully
    ],
  }

  const stageLinq = new StageLinq(stageLinqOptions);

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


  stageLinq.discovery.on('newDiscoveryDevice', (info) => {
    console.log(`[DISCOVERY] New Device ${Buffer.from(info.token).toString('hex')} ${info.source} ${info.software.name} ${info.software.version}`)
  }); 

  stageLinq.discovery.on('announcing', (info) => {
    console.log(`[DISCOVERY] Broadcasting Announce ${Buffer.from(info.token).toString('hex')} disc Port ${info.port} ${info.source} ${info.software.name}:${info.software.version}`)
  }); 


  stageLinq.devices.on('newDevice', (device) => {
    console.log(`[DEVICES] New Device ${device.deviceId.string}`)
  });

  stageLinq.devices.on('newService', (device, service) => {
    console.log(`[DEVICES] New ${service.name} Service on ${device.deviceId.string} port ${service.serverInfo.port}`)
  });


  if (stageLinq.stateMap) {

    stageLinq.stateMap.on('stateMessage', async (data: ServiceMessage<Services.StateData>) => {
      console.log(`[STATEMAP] ${data.deviceId.string} ${data.message.name} => ${JSON.stringify(data.message.json)}`);
    });

    stageLinq.stateMap.on('newDevice', (service: Services.StateMapDevice) => {
      console.log(`[STATEMAP] Subscribing to States on ${service.deviceId.string}`);
      service.subscribe();
      stageLinq.status.addPlayer({
        stateMap: service,
        address: service.socket.remoteAddress,
        port: service.socket.remotePort,
        deviceId: service.deviceId,
      })
    });


    stageLinq.status.on('trackLoaded', async (status) => {
      console.log(`[STATUS] Track Loaded ${status.deviceId.string}`);

      const split = status.trackNetworkPath.substring(43).split('/')
      const sourceName = split.shift();
      const path = `/${sourceName}/${split.join('/')}`

      if (stageLinq.fileTransfer) {              
        if (stageLinqOptions.downloadDbSources) {
          getTrackInfo(stageLinq, sourceName, status.deviceId, status.trackNetworkPath);
          downloadFile(stageLinq, sourceName, status.deviceId, path, Path.resolve(os.tmpdir()));
        }
      } 
    });
    stageLinq.status.on('nowPlaying', async (status) => {
      console.log(`[STATUS] Now Playing ${status.deviceId.string}`);
    });

    stageLinq.status.on('stateChanged', async (status) => {
      console.log(`[STATUS] State Changed ${status.deviceId.string}`);
    });
  }


  if (stageLinq.fileTransfer) {

    stageLinq.fileTransfer.on('fileTransferProgress', (file, txid, progress) => {
      console.log(`[FILETRANSFER] {${txid}} Reading ${file}: ${progressBar(10, progress.bytesDownloaded, progress.total)} (${Math.ceil(progress.percentComplete)}%)`);
    });

    stageLinq.fileTransfer.on('fileTransferComplete', (file, txid) => {
      console.log(`[FILETRANSFER] Complete {${txid}} ${file}`);
    });

    stageLinq.fileTransfer.on('newSource', (_source: Source) => {
      console.log(`[FILETRANSFER] Source Available: (${_source.name})`);
    });

    stageLinq.fileTransfer.on('sourceRemoved', (sourceName: string, deviceId: DeviceId) => {
      console.log(`[FILETRANSFER] Source Removed: ${sourceName} on ${deviceId.string}`);
    });

    stageLinq.databases.on('dbDownloaded', (_source: Source) => {
      console.log(`[FILETRANSFER] Database Downloaded: (${_source.name})`);
    });

  }


  if (stageLinq.beatInfo) {

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
    function beatCallback(bd: ServiceMessage<Services.BeatData>,) {
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


    stageLinq.beatInfo.on('newBeatInfoDevice', async (beatInfo: Services.BeatInfo) => {
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
        
        function beatFunc(beatInfo: Services.BeatInfo) {
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
