import { sleep } from '../utils/sleep';
import { StageLinq } from '../StageLinq';
// import * as fs from 'fs';
require('console-stamp')(console, {
  format: ':date(HH:MM:ss) :label',
});

(async () => {

  console.log('Starting CLI');

  const stageLinq = new StageLinq({
    useDatabases: true
  });

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
  // stageLinq.logger.on('silly', (...args: any) => {
  //   console.debug(...args)
  // });

  // Fires when we connect to any device
  stageLinq.devices.on('connected', (connectionInfo) => {
    console.log(`Successfully connected to ${connectionInfo.software.name}`);

    if (stageLinq.options.useDatabases) {
      stageLinq.databases.on('downloading', (sourceName, dbPath) => {
        console.log(`Downloading ${sourceName} to ${dbPath}`);
      });
      stageLinq.databases.on('dbDownloaded', (sourceName, dbPath) => {
        console.log(`Database (${sourceName}) has been downloaded to ${dbPath}`);
      });
    }

  });

  stageLinq.devices.on('ready', (connectionInfo) => {
    console.log(`Device ${connectionInfo.software.name} is ready!`);
  });

  stageLinq.devices.on('trackLoaded', async (status) => {
    if (stageLinq.options.useDatabases) {
      if (status.source) {
        try {
          const result = stageLinq.databases.querySource(status.source,
            `SELECT * FROM Track WHERE path = '${status.trackPath}'`);
          console.log('Database entry:', result);
        } catch(e) {
          console.error(e);
        }
      }
    }
    console.log('New track loaded:', status);
  });

  stageLinq.devices.on('nowPlaying', (status) => {
    console.log(`Now Playing on [${status.deck}]: ${status.title} - ${status.artist}`)
  });

  stageLinq.devices.on('message', (connectionInfo, data) => {
    const msg = data.message.json
      ? JSON.stringify(data.message.json)
      : data.message.interval;
    console.debug(`${connectionInfo.address}:${connectionInfo.port} ` +
      `${data.message.name} => ${msg}`);
  });

  // stageLinq.devices.on('stateChanged', (status) => {
  //   console.log(`State changed on [${status.deck}]`, status)
  // });

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
