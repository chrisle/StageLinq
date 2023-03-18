// import { ActingAsDevice, PlayerStatus, StageLinqOptions, ServiceList, DeviceId, Source } from '../types';
// import * as Services from '../services'
// import { DbConnection } from "../Databases";
// import { sleep } from '../utils/sleep';
// import { StageLinq } from '../StageLinq';
// import * as fs from 'fs';
// import * as os from 'os';
// import * as path from 'path';
// import { Player } from '../devices/Player';


// require('console-stamp')(console, {
//   format: ':date(HH:MM:ss) :label',
// });

// /**
//  * Get track information for latest playing song.
//  *
//  * @param stageLinq Instance of StageLinq.
//  * @param status Player to get track info from.
//  * @returns Track info
//  */

// //let dbDownloaded: boolean = false;

// function progressBar(size: number, bytes: number, total: number): string {

//   const progress = Math.ceil((bytes / total) * 10)
//   let progressArrary = new Array<string>(size);
//   progressArrary.fill(' ');
//   if (progress) {
    
//     for (let i=0; i<progress; i++) {
//       progressArrary[i] = '|'
//     }
//   }
//   return `[${progressArrary.join('')}]`
// }

// async function getTrackInfo(stageLinq: StageLinq, status: PlayerStatus) {

//   try {
//     const dbPath = stageLinq.databases.getDbPath(status.dbSourceName)
//     const connection = new DbConnection(dbPath.database.local.path);
//     const result = await connection.getTrackInfo(status.trackPath);
//     connection.close();
//     console.log('Database entry:', result);
//     return result;
//   } catch(e) {
//     console.error(e);
//   }
// }

// /**
//  * Download the currently playing song from the media.
//  *
//  * @param stageLinq Instance of StageLinq.
//  * @param status Player to download the current song from.
//  * @param dest Path to save file to.
//  */


// async function downloadFile(stageLinq: StageLinq, status: PlayerStatus, dest: string) {
//   //
//   // try {
//   //   const data = await stageLinq.downloadFile(status.deviceId, status.dbSourceName);
//   //   if (data) {
//   //     fs.writeFileSync(dest, Buffer.from(data));
//   //     console.log(`Downloaded ${status.trackPathAbsolute} to ${dest}`);
//   //   }
//   // } catch(e) {
//   //   console.error(`Could not download ${status.trackPathAbsolute}`);
//   //   console.error(e)
//   // }
// }


// async function main() {
  
//   console.log('Starting CLI');

//   const stageLinqOptions: StageLinqOptions = {

//     // If set to true, download the source DBs in a temporary location.
//     // (default: true)
//     downloadDbSources: true,

//     // Max number of attempts to connect to a StageLinq device.
//     // (default: 3)
//     maxRetries: 3,

//     // What device to emulate on the network.
//     // (default: Now Playing)
//     actingAs: ActingAsDevice.NowPlaying,

//     services: [
//       ServiceList.StateMap,
//       ServiceList.BeatInfo,
//       ServiceList.FileTransfer,
//     ],
//   }

//   const downloadFlag = false;

//   const stageLinq = new StageLinq(stageLinqOptions);  

//   stageLinq.logger.on('error', (...args: any) => {
//     console.error(...args);
//   });
//   stageLinq.logger.on('warn', (...args: any) => {
//     console.warn(...args);
//     args.push("\n");
//   });
//   stageLinq.logger.on('info', (...args: any) => {
//     console.info(...args);
//     args.push("\n");
//   });
//   stageLinq.logger.on('log', (...args: any) => {
//     console.log(...args);
//     args.push("\n");
//   });
//   stageLinq.logger.on('debug', (...args: any) => {
//     console.debug(...args);
//     args.push("\n");
//   });
//   //Note: Silly is very verbose!
//   // stageLinq.logger.on('silly', (...args: any) => {
//   //   console.debug(...args);
//   // });

//   // Fires when we connect to any device
//   //stageLinq.on('connected', async (connectionInfo) => {
//   //  console.log(`Successfully connected to ${connectionInfo.software.name}`);

//     if (stageLinq.options.downloadDbSources) {
//       // Fires when the database source starts downloading.
//       stageLinq.databases.on('dbDownloading', (sourceName, dbPath) => {
//         console.log(`Downloading ${sourceName} to ${dbPath}`);
//       });

//       // Fires while the database source is being read
//       stageLinq.databases.on('dbProgress', ( sourceName, total, bytes, percent) => {
//         //console.debug(`Reading ${sourceName}: ${bytes}/${total} (${Math.ceil(percent)}%)`);
//         console.debug(`Reading ${sourceName}: ${progressBar(10,bytes,total)} (${Math.ceil(percent)}%)`);
//       });

//       // Fires when the database source has been read and saved to a temporary path.
//       stageLinq.databases.on('dbDownloaded', (sourceName, dbPath) => {
//         console.log(`Database (${sourceName}) has been downloaded to ${dbPath}`);
//        // dbDownloaded = true;
//       });

//       stageLinq.databases.on('dbNewSource', (source: Source) => {
//         console.log(`New Source Available (${source.name})`);
//        // dbDownloaded = true;
//       });


//       stageLinq.on('fileProgress', (file, total, bytes, percent) => {
//         //Logger.warn(thisTxid, txid);
//         //if (thisTxid === txid) {
//           //this.emit('fileProgress', path.split('/').pop(), progress.total, progress.bytesDownloaded, progress.percentComplete);
//           console.debug(`Reading ${file}: ${progressBar(10,bytes,total)} (${Math.ceil(percent)}%)`);
//         //}
//       });
//     }

//   //});

//   // Fires when StageLinq and all devices are ready to use.
//   // stageLinq.on('ready', () => {
//   //   console.log(`StageLinq is ready!`);
//   // });

//   // Fires when a new track is loaded on to a player.
//   // stageLinq.on('trackLoaded', async (status) => {

//   //   // Example of how to connect to the database using this library's
//   //   // implementation of BetterSqlite3 to get additional information.
//   //   if (stageLinq.options.downloadDbSources) {
//   //     getTrackInfo(stageLinq, status);
//   //   }

//   //   // Example of how to download the actual track from the media.
//   //   const filename = [status.title,'.mp3'].join('');
//   //   await downloadFile(stageLinq, status, path.resolve(os.tmpdir(), filename));
//   // });

//   // // Fires when a track has started playing.
//   // stageLinq.on('nowPlaying', (status) => {
//   //   console.log(`Now Playing on [${status.deck}]: ${status.title} - ${status.artist}`)
//   // });

//   // Fires when StageLinq receives messages from a device.
  
//   stageLinq.stateMap.on('newStateMapDevice',  (deviceId: DeviceId, service: InstanceType <typeof Services.StateMap>) => { 
//     console.log(`Subscribing to States on ${deviceId.toString()}`);
    
//     const player = new Player({
//       stateMap: service,
//       address: service.socket.remoteAddress,
//       port: service.socket.remotePort,
//       deviceId: deviceId,
//     });

//     //wait for Player to setup
//     while (!player.ready) {
//       sleep(250);
//     }

//     service.subscribe();

//     player.on('trackLoaded', async (status) => {
//       if (stageLinq.options.downloadDbSources && downloadFlag) {
//         getTrackInfo(stageLinq, status);
//       }
  
//       // Example of how to download the actual track from the media.
      
//       if (downloadFlag) {
//         const filename = [status.title,'.mp3'].join('');
//         while (!stageLinq.hasSource(status.dbSourceName)) {
//           await sleep(250);
//         }
//         await downloadFile(stageLinq, status, path.resolve(os.tmpdir(), filename));
//       }

//     });

//     player.on('stateChanged', (status) => {
//       console.log(`Updating state [${status.deck}]`, status)
//     });

//     player.on('nowPlaying', (status) => {
//       console.log(`Now Playing on [${status.deck}]: ${status.title} - ${status.artist}`)
//     });
//    });
  
//   // stageLinq.stateMap.on('stateMessage',  (data) => { 
//   //  if (data.message.json) {
//   //   const msg = data.message.json
//   //   ? JSON.stringify(data.message.json)
//   //   : data.message.interval;
//   //   console.debug(`${data.deviceId.toString()} ` +
//   //   `${data.message.name} => ${msg}`);
  
//   //  }
  
//   // });
  
//   // Fires when the state of a device has changed.
//   // stageLinq.on('stateChanged', (status) => {
//   //   console.log(`Updating state [${status.deck}]`, status)
//   // });

//   /////////////////////////////////////////////////////////////////////////
//   // CLI

//   let returnCode = 0;
//   try {
//     process.on('SIGINT', async function () {
//       console.info('... exiting');
      
//       // Ensure SIGINT won't be impeded by some error

//       try {
//         await stageLinq.disconnect();
//       } catch (err: any) {
//         const message = err.stack.toString();
//         console.error(message);
//       }
//       process.exit(returnCode);
//     });

//     await stageLinq.connect();

//     while (true) {
//       await sleep(250);
//     }

//   } catch (err: any) {
//     const message = err.stack.toString();
//     console.error(message);
//     returnCode = 1;
//   }

//   await stageLinq.disconnect();
//   process.exit(returnCode);
// }

// main();
