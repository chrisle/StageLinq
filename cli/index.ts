import { ActingAsDevice } from '../types';
import { DbConnection } from "../Databases";
import { sleep } from '../utils/sleep';
import { StageLinq } from '../StageLinq';
require('console-stamp')(console, {
  format: ':date(HH:MM:ss) :label',
});


(async () => {

  console.log('Starting CLI');

  const stageLinqOptions = {

    // If set to true, download the source DBs in a temporary location.
    // (default: true)
    downloadDbSources: true,

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
  });

  // Fires when StageLinq has successfully connect to at least one device and is ready to use.
  stageLinq.devices.on('ready', (connectionInfo) => {
    console.log(`Device ${connectionInfo.software.name} is ready!`);
  });

  // Fires when a new track is loaded on to a player.
  stageLinq.devices.on('trackLoaded', async (status) => {

    // Example of how to connect to the database using this library's
    // implementation of BetterSqlite3 to get additional information.
    if (stageLinq.options.downloadDbSources && status.dbSourceName) {
      try {
        const connection = new DbConnection(stageLinq.databases.getDbPath(status.dbSourceName));
        const result = connection.getTrackInfo(status.trackPath);
        connection.close();
        console.log('Database entry:', result);
      } catch(e) {
        console.error(e);
      }
    }
    console.log('New track loaded:', status);
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
    console.log(`State changed on [${status.deck}]`, status)
  });

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
})();
