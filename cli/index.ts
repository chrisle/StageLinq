import { sleep } from '../utils/sleep';
import { StageLinq } from '../StageLinq';
import { Logger } from '../utils/Logger';

(async () => {
  Logger.log('Starting CLI');

  const stageLinq = new StageLinq();

  stageLinq.on('trackLoaded', (status) => {
    Logger.log('New track loaded:', status);
  });

  stageLinq.on('nowPlaying', (status) => {
    Logger.log(`Now Playing on [${status.deck}]: ${status.title} - ${status.artist}`)
  });

  stageLinq.on('connected', () => {
    Logger.log(`******** CONNECTED TO MORE THAN TWO **********`);;
  });

  // stageLinq.on('player', (status) => {
  //   Logger.log('Player status change', status);
  // });

  let returnCode = 0;
  try {
    process.on('SIGINT', async function () {
      Logger.info('... exiting');
      // Ensure SIGINT won't be impeded by some error
      try {
        await stageLinq.disconnect();
      } catch (err) {
        const message = err.stack.toString();
        Logger.error(message);
      }
      process.exit(returnCode);
    });

    await stageLinq.connect();

    while (true) {
      await sleep(250);
    }

  } catch (err) {
    const message = err.stack.toString();
    Logger.error(message);
    returnCode = 1;
  }

  await stageLinq.disconnect();
  process.exit(returnCode);
})();
