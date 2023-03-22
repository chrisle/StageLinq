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
    
    for (let i=0; i<progress; i++) {
      progressArrary[i] = '|'
    }
  }
  return `[${progressArrary.join('')}]`
}

async function getTrackInfo(stageLinq: StageLinq, sourceName: string, deviceId: DeviceId, trackName: string) {
  while (!stageLinq.sources.hasSource(sourceName, deviceId)) {
    await sleep(250);
  }
  try {
    const _source = stageLinq.sources.getSource(sourceName, deviceId);
    //const dbPath = stageLinq.databases.getDbPath(status.dbSourceName)
    const connection = _source.database.connection;
    const result = await connection.getTrackInfo(trackName);
    //connection.close();
    console.log('Database entry:', result);
    return result;
  } catch(e) {
    console.error(e);
  }
}

async function downloadFile(stageLinq: StageLinq, sourceName: string, deviceId: DeviceId, path: string, dest?: string) {
  
  while (!stageLinq.sources.hasSource(sourceName, deviceId)) {
    await sleep(250);
  }
  try {
    const _source = stageLinq.sources.getSource(sourceName, deviceId);
    const data = await stageLinq.downloadFile(_source, path);
    if (dest && data) {
      const filePath = `${dest}/${path.split('/').pop()}`
      
      fs.writeFileSync(filePath, Buffer.from(data));
      console.log(`Downloaded ${path} to ${dest}`);
    }
  } catch(e) {
    console.error(`Could not download ${path}`);
    console.error(e)
  }
}

let source: Map<string, Source> = new Map();


async function main() {

  console.log('Starting CLI');
  const stageLinqOptions: StageLinqOptions = {
    downloadDbSources: true,
    maxRetries: 3,
    actingAs: ActingAsDevice.NowPlaying,
    services: [
      ServiceList.StateMap,
      ServiceList.BeatInfo,
      ServiceList.FileTransfer,
      ServiceList.TimeSynchronization,
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
  stageLinq.logger.on('debug', (...args: any) => {
    console.debug(...args);
    args.push("\n");
  });
  //Note: Silly is very verbose!
  // stageLinq.logger.on('silly', (...args: any) => {
  //   console.debug(...args);
  // });


  //stageLinq.status.on()


  stageLinq.devices.on('newDevice', (device) =>{
    console.log(`DEVICES New Device ${device.deviceId.string}`)
  });

  stageLinq.devices.on('newService', (device, service) =>{
    console.log(`DEVICES New ${service.name} Service on ${device.deviceId.string}`)
  });

  if (stageLinq.stateMap) {
    
    stageLinq.stateMap.on('stateMessage', async (data: ServiceMessage<Services.StateData>) => { 
      if (data.message.json) {
        //console.debug(`${data.message.name} => ${JSON.stringify(data.message.json)}`);
        if (data.message.json.string && data.message.name.split('/').pop() === "TrackNetworkPath") {
          const split = data.message.json.string.substring(43,data.message.json.string.length).split('/')
          const sourceName = split.shift();
          const path = `/${sourceName}/${split.join('/')}`
          await getTrackInfo(stageLinq, sourceName, data.deviceId, data.message.json.string);
          downloadFile(stageLinq, sourceName, data.deviceId, path, Path.resolve(os.tmpdir()));

        }
      }
     });
     
     stageLinq.stateMap.on('newDevice',  (service: Services.StateMapDevice) => { 
      console.log(`Subscribing to States on ${service.deviceId.string}`);
      service.subscribe();
      stageLinq.status.addPlayer({
          stateMap: service,
          address: service.socket.remoteAddress,
          port: service.socket.remotePort,
          deviceId: service.deviceId,
      })
     });

     stageLinq.status.on('trackLoaded', async (status) => {
        console.log(`STATUS Track Loaded ${status.deviceId.string}`);
        console.dir(status);
      
      // if (stageLinq.options.downloadDbSources && downloadFlag) {
            //   getTrackInfo(stageLinq, status);
            // }
        
            // // Example of how to download the actual track from the media.
            
            // if (downloadFlag) {
            //   const filename = [status.title,'.mp3'].join('');
            //   while (!stageLinq.hasSource(status.dbSourceName)) {
            //     await sleep(250);
            //   }
            //   await downloadFile(stageLinq, status, path.resolve(os.tmpdir(), filename));
            // }
      
      });
      stageLinq.status.on('nowPlaying', async (status) => {
        console.log(`STATUS Now Playing ${status.deviceId.string}`);
        console.dir(status);       
      
      });
      
      stageLinq.status.on('stateChanged', async (status) => {
        console.log(`STATUS State Changed ${status.deviceId.string}`);
        console.dir(status);
      
      });

  }
  
  if (stageLinq.fileTransfer) {
    
    stageLinq.fileTransfer.on('fileTransferProgress', (file, txid, progress) => {
      console.debug(`{${txid}} Reading ${file}: ${progressBar(10,progress.bytesDownloaded, progress.total)} (${Math.ceil(progress.percentComplete)}%)`);
    });

    stageLinq.fileTransfer.on('dbNewSource', (_source: Source) => {
      console.log(`New Source Available (${_source.name})`);
      source.set(_source.name, _source)
    });
  
    stageLinq.databases.on('dbDownloaded', (_source: Source) => {
      console.log(`New Downloaded Database (${_source.name})`);
      source.set(_source.name, _source);
    });

  }

  if (stageLinq.beatInfo) {

    stageLinq.beatInfo.on('newBeatInfoDevice', (beatInfo: Services.BeatInfo) => {

        //  User callback function. 
        //  Will be triggered everytime a player's beat counter crosses the resolution threshold
        function beatCallback(bd: ServiceMessage<Services.BeatData>, ) {
          let deckBeatString = ""
          for (let i=0; i<bd.message.deckCount; i++) {
            deckBeatString += `Deck: ${i+1} Beat: ${bd.message.deck[i].beat.toFixed(3)}/${bd.message.deck[i].totalBeats.toFixed(0)} `
          }
          
          //if (beatInfo.deviceId.string == "4be14112-5ead-4848-a07d-b37ca8a7220e") {
            console.log(`${bd.deviceId.string} clock: ${bd.message.clock} ${deckBeatString}`);  
          //}
          //console.log(`BeatInfo: ${beatInfo.deviceId.string} ${deckBeatString}`);
        }
        
        //  User Options
        const beatOptions = {
          // Resolution for triggering callback
          //    0 = every message WARNING, it's a lot!
          //    1 = every beat 
          //    4 = every 4 beats 
          //    .25 = every 1/4 beat
          everyNBeats: 1, 
        }
        //  start BeatInfo
        //  callback is optional, BeatInfo messages can be consumed by event messages, or reading the register 
        beatInfo.startBeatInfo(beatOptions, beatCallback);
        
        // beatInfo.startBeatInfo(beatOptions);
        // stageLinq.beatInfo.on('beatMsg', (bd) => {
        //   if (bd.message) {
        //     beatCallback(bd);
        //   }
        // });
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
