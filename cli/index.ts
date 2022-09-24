import { ActingAsDevice, PlayerStatus } from '../types';
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

async function main() {

  console.log('Starting CLI');

  const stageLinqOptions = {

    // If set to true, download the source DBs in a temporary location.
    // (default: true)
    downloadDbSources: false,

    // Max number of attempts to connect to a StageLinq device.
    // (default: 3)
    maxRetries: 3,

    // What device to emulate on the network.
    // (default: Now Playing)
    actingAs: ActingAsDevice.NowPlaying
  }

  const stageLinq = new StageLinq(stageLinqOptions);

  // Setup how you want to handle logs coming from StageLinq
  stageLinq.logger.on('error', (...args: any) => {
    console.error(...args);
  });
  stageLinq.logger.on('warn', (...args: any) => {
    console.warn(...args);
  });
  stageLinq.logger.on('info', (...args: any) => {
    console.info(...args);
  });
  stageLinq.logger.on('log', (...args: any) => {
    console.log(...args);
  });
  stageLinq.logger.on('debug', (...args: any) => {
    console.debug(...args);
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
    await downloadFile(stageLinq, status, path.resolve(os.tmpdir(), 'media'));
  });

  // Fires when a track has started playing.
  stageLinq.devices.on('nowPlaying', (status) => {
    console.log(`Now Playing on [${status.deck}]: ${status.title} - ${status.artist}`)
  });

  // Fires when StageLinq receives messages from a device.
  stageLinq.devices.on('message', (connectionInfo, data) => {
    const msg = data.message.json
      ? JSON.stringify(data.message.json)
      : data.message.interval;
    console.debug(`${connectionInfo.address}:${connectionInfo.port} ` +
      `${data.message.name} => ${msg}`);
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
