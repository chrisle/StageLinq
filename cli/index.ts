import { ActingAsDevice, PlayerStatus, StageLinqOptions, Services } from '../types';
import { DbConnection } from "../Databases";
import { sleep } from '../utils/sleep';
import { StageLinq } from '../StageLinq';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';


require('console-stamp')(console, {
  format: ':date(HH:MM:ss) :label',
});

/**
 * Get track information for latest playing song.
 *
 * @param stageLinq Instance of StageLinq.
 * @param status Player to get track info from.
 * @returns Track info
 */
function getTrackInfo(stageLinq: StageLinq, status: PlayerStatus) {
  try {
    const dbPath = stageLinq.databases.getDbPath(status.dbSourceName)
    const connection = new DbConnection(dbPath);
    const result = connection.getTrackInfo(status.trackPath);
    connection.close();
    console.log('Database entry:', result);
    return result;
  } catch(e) {
    console.error(e);
  }
}

/**
 * Download the currently playing song from the media.
 *
 * @param stageLinq Instance of StageLinq.
 * @param status Player to download the current song from.
 * @param dest Path to save file to.
 */

/*
async function downloadFile(stageLinq: StageLinq, status: PlayerStatus, dest: string) {
  try {
    const data = await stageLinq.devices.downloadFile(status.deviceId, status.trackPathAbsolute);
    if (data) {
      fs.writeFileSync(dest, Buffer.from(data));
      console.log(`Downloaded ${status.trackPathAbsolute} to ${dest}`);
    }
  } catch(e) {
    console.error(`Could not download ${status.trackPathAbsolute}`);
  }
}
*/
//1e6c417a-b674-4c87-b4aa-fb7ad2298976
//6b0d659c-dffa-464e-8580-54fe3e21770b
//3536b2f3-c80a-4322-89d4-2aceccb60cfb
//d3fea2b3-a934-47c9-a9a0-1a242db624fe

/*
let fltxBlock = false;

async function downloadFileTest(stageLinq: StageLinq, trackNetworkPath: string, dest: string) {
  
  await sleep(2000);
  
  while (fltxBlock === true) {
    await sleep(250);
  }

  const deviceId = trackNetworkPath.substring(6,42);
  //const deviceId = '1e6c417a-b674-4c87-b4aa-fb7ad2298976';
  const trackPath = trackNetworkPath.substring(42);
  const fileName = trackNetworkPath.split('/').pop();
  console.log(fileName);
  dest += fileName
  console.log(dest);
  //const dest = '../'
  try {
    const data = await stageLinq.devices.downloadFile(deviceId, trackPath);
    if (data) {
      fs.writeFileSync(dest, Buffer.from(data));
      console.log(`Downloaded ${trackPath} from ${deviceId} to ${dest}`);
      fltxBlock = false;
    }
  } catch(e) {
    console.error(`Could not download ${trackPath} Error: ${e}`);
  }
  
}
*/


async function main() {

  console.log('Starting CLI');

  const stageLinqOptions: StageLinqOptions = {

    // If set to true, download the source DBs in a temporary location.
    // (default: true)
    downloadDbSources: false,

    // Max number of attempts to connect to a StageLinq device.
    // (default: 3)
    maxRetries: 3,

    // What device to emulate on the network.
    // (default: Now Playing)
    actingAs: ActingAsDevice.NowPlaying,

    services: [
      Services.StateMap,
      Services.FileTransfer,
      Services.Directory,
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
  // Note: Silly is very verbose!
  // stageLinq.logger.on('silly', (...args: any) => {
  //   console.debug(...args);
  // });

  // Fires when we connect to any device
  stageLinq.devices.on('connected', async (connectionInfo) => {
    console.log(`Successfully connected to ${connectionInfo.software.name}`);

    if (stageLinq.options.downloadDbSources) {
      // Fires when the database source starts downloading.
      stageLinq.databases.on('dbDownloading', (sourceName, dbPath) => {
        console.log(`Downloading ${sourceName} to ${dbPath}`);
      });

      // Fires while the database source is being read
      stageLinq.databases.on('dbProgress', (sourceName, total, bytes, percent) => {
        console.debug(`Reading ${sourceName}: ${bytes}/${total} (${Math.ceil(percent)}%)`);
      });

      // Fires when the database source has been read and saved to a temporary path.
      stageLinq.databases.on('dbDownloaded', (sourceName, dbPath) => {
        console.log(`Database (${sourceName}) has been downloaded to ${dbPath}`);
      });
    }

  });

  // Fires when StageLinq and all devices are ready to use.
  stageLinq.devices.on('ready', () => {
    console.log(`StageLinq is ready!`);
  });

  // Fires when a new track is loaded on to a player.
  stageLinq.devices.on('trackLoaded', async (status) => {

    // Example of how to connect to the database using this library's
    // implementation of BetterSqlite3 to get additional information.
    if (stageLinq.options.downloadDbSources) {
      getTrackInfo(stageLinq, status);
    }

    // Example of how to download the actual track from the media.
    //await downloadFile(stageLinq, status, path.resolve(os.tmpdir(), 'media'));
  });

  // Fires when a track has started playing.
  stageLinq.devices.on('nowPlaying', (status) => {
    console.log(`Now Playing on [${status.deck}]: ${status.title} - ${status.artist}`)
  });

  // Fires when StageLinq receives messages from a device.
  stageLinq.devices.on('message',  async (data) => { 
    const msg = data.message.json
      ? JSON.stringify(data.message.json)
      : data.message.interval;
    console.debug(`${data.message.socket.remoteAddress}:${data.message.socket.remotePort} ` +
      `${data.message.name} => ${msg}`);
    
    //console.dir(data);
    
    //if (data && data.socket && data.message && data.message.json ) { //&& typeof data.message !== "object") {
      //console.debug(`${data.socket.remoteAddress}:${data.socket.remotePort} ${data.message.name} ${JSON.stringify(data.message.json)}`);
     // if (data.message.name.substring(data.message.name.length -16,data.message.name.length) === "TrackNetworkPath" && data.message.json.string !== "") {
        //console.log(data.message.json.string);
        //console.log(data.message.json.string.substring(6,42),data.message.json.string.substring(42));
      //  await downloadFileTest(stageLinq, data.message.json.string, path.resolve(os.tmpdir()));
      //}
   // }

    //if (data.message.name.substring()) {}
    
  });
  

  // Fires when the state of a device has changed.
  stageLinq.devices.on('stateChanged', (status) => {
    console.log(`Updating state [${status.deck}]`, status)
  });

  /////////////////////////////////////////////////////////////////////////
  // CLI

  let returnCode = 0;
  try {
    process.on('SIGINT', async function () {
      console.info('... exiting');
      
      // Ensure SIGINT won't be impeded by some error

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
