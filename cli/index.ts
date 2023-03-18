import { ActingAsDevice, StageLinqOptions, ServiceList, ServiceMessage, Source} from '../types';
import * as Services from '../services'
import { sleep } from '../utils/sleep';
import { StageLinq } from '../StageLinq';



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


async function downloadFile(stageLinq: StageLinq, sourceName: string, path: string, dest?: string) {
  //
  
  while (!source.has(sourceName)) {
    await sleep(250);
  }
  const _source = source.get(sourceName);
  try {
    const data = await stageLinq.downloadFile(_source, path);
    if (dest && data) {
      //fs.writeFileSync(, Buffer.from(data));
      //console.log(`Downloaded ${status.trackPathAbsolute} to ${dest}`);
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
    ],
  }
  
  const stageLinq = new StageLinq(stageLinqOptions);  

  stageLinq.on('fileProgress', (file, total, bytes, percent) => {
      console.debug(`Reading ${file}: ${progressBar(10,bytes,total)} (${Math.ceil(percent)}%)`);
  });


  if (stageLinq.stateMap) {
    
    stageLinq.stateMap.on('stateMessage',  (data: ServiceMessage<Services.StateData>) => { 
      if (data.message.json) {
        console.debug(`${data.message.name} => ${JSON.stringify(data.message.json)}`);
        if (data.message.json.string && data.message.name.split('/').pop() === "TrackNetworkPath") {
          const split = data.message.json.string.substring(43,data.message.json.string.length).split('/')
          const sourceName = split.shift();
          const path = `/${sourceName}/${split.join('/')}`
          //console.log(sourceName, path, data.message.json.string);
          downloadFile(stageLinq, sourceName, path);
        }
      }
     });
     
     stageLinq.stateMap.on('newDevice',  (service: Services.StateMapDevice) => { 
      console.log(`Subscribing to States on ${service.deviceId.toString()}`);
      service.subscribe();
     });

  }
   

   stageLinq.databases.on('dbNewSource', (_source: Source) => {
    console.log(`New Source Available (${_source.name})`);
    source.set(_source.name, _source)
  });

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
