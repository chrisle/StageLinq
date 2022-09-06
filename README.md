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

## Overview

The idea behind this library is to have a structure something like this:

**StageLinq > Devices > Player > Deck**

A StageLinq sets up a device listener and a class that handles all the
devices (`StageLinqDevices`).

`StageLinqDevices` figures out if it wants to connect or not and handles
connections. There may be one or more device on the network. For each device it will try to connect to it and subscribe to it's `StateMap`.

Currently there is only one type of device: `Player`. A `Player` may have up to
4 decks A, B, C, D (aka "layers"). The `Player` handles incoming messages,
parses them, groups them, and emits events. These events bubble up to the
`Device`.

## Logging

I needed the logging to be used outside of the library so I made them events
that you can listen to.

* `error`: When something bad happens.
* `warn`: When something happens but doesn't affect anything.
* `info`/`log`: When we have something to say
* `debug`: Spits out the parsed version of the packets.
* `silly`: Dumps all kinds of internal stuff
*
## About

Forked from @MarByteBeep's code.

Additional reverse engineering work: https://github.com/chrisle/stagelinq-pcap

Used in my app Now Playing https://www.nowplaying2.com
