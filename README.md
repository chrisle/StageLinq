# StageLinq

NodeJS library implementation to access information through the Denon StageLinq protocol.

# Features

* Tested with Denon two SC6000, Prime 4, Prime 2, and Prime Go.
* Event emitters for state changes, tracks getting loaded, and current playing track.
* Event emitter for debug logging.

---

## Example

```ts
import { StageLinq } from 'StageLinq';

async function main() {
  const stageLinq = new StageLinq();

  // Print the logging output to the console.
  stageLinq.logger.on('error', (...args: any) => { console.error(...args); });
  stageLinq.logger.on('warn', (...args: any) => { console.warn(...args); });
  stageLinq.logger.on('info', (...args: any) => { console.info(...args); });
  stageLinq.logger.on('log', (...args: any) => { console.log(...args); });
  stageLinq.logger.on('debug', (...args: any) => { console.debug(...args); });
  stageLinq.logger.on('silly', (...args: any) => { console.debug(...args); });

  // Fires when a new track is loaded into a device.
  stageLinq.devices.on('trackLoaded', (status) => {
    console.log(`New track loaded on to deck ${status.deck}`, status);
  });

  // Fires when the state of the device changes.
  stageLinq.devices.on('stateChanged', (status) => {
    console.log(`State of ${status.deck} changed`, status);
  });

  // Fires when a new track is playing.
  stageLinq.devices.on('nowPlaying', (status) => {
    console.log(`Now playing on ${status.deck}`, status);
  })

  await stageLinq.connect();

  // Loop forever
  const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
  };
  while(true) { sleep(250); }
}
```

---


## About

Forked from @MarByteBeep's code.

Additional reverse engineering work: https://github.com/chrisle/stagelinq-pcap

Used in my app Now Playing https://www.nowplaying2.com
