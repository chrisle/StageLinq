# StageLinq - Listener Proof of Concept

## Description
This branch demonstrates a novel way of handling connections with devices and their services on the StageLinq network.
Rather than searching out devices via discovery, we are able to have devices initiate connections to the library. As demonstrated, this approach:
* Greatly reduces complexity. 

* Speeds up the connection & initialization process (almost every sleep() call has been eliminated without and affect thus far).

* Handles disconnection and reconnection of devices gracefully and simply.

* Allows connections from devices we couldn't use previously (i.e. x1800/x1850 mixers).

## Method Summary
* Instantiate a net.Server for each service we wish to implement.
  
* Write a DiscoveryMessage which includes the port on which the Discovery service is listening, and announce ourselves on UDP port 51337.

* StageLinq devices on the network will initiate a connection to the Directory service, and send a Service Request (0x2).

* Reply to each device with a Service Announcement (0x0) for each of the services we offer and the port we are listening to them on.

* If a device implements that service it will initiate a connection, sending a Service Announcement (0x0), a Network String with the name of the service, and the port it is using.

* The connection to this Device-Service is now open, and we can use it as we normally would.

* If a connection is lost to a device, it will simply reconnect.

### Additional Notes on the Listener Method

* The Directory service is the only one which is *required* as it is the initial connection endpoint for remote devices.

* Only tokens of a specific structure seem to work, otherwise devices won't initiate a connection. One requirement *seems* to be that they start with `0xFF FF FF FF FF FF`, but some more research into this is needed.

### Implementing Selected Services
We can choose which services to implement in the initialize() method in StageLinqDevices.ts
```ts 
  async initialize(): Promise<AddressInfo> {
    
    await this.startServiceListener(StateMap);
    await this.startServiceListener(FileTransfer);
    const directory = await this.startServiceListener(Directory); //we need the server's port for announcement message

    return directory.serverInfo
  } 
  ```

## Other Changes Implemented in Listener

* When a device is shutdown, it sends a Disconnection message (0x9) to connected FileTransfer service. 

* Network Device has been eliminated. 
  * Directory is now an extended instance of Service.
  * The connectToService factory function has been moved to StageLinqDevices (renamed startServiceListener);
*  Created a DeviceId class, to assist handling deviceIds.
    * An instance of DeviceId holds both the buffer and formatted UUID-type string.
    * It has methods for retrieving the string or buffer.
* Created some other type definitions (IpAddressPort) to better communicate what properties are expecting.
* Instances of Service have a new abstract method, parseServiceData. This is just because ServiceAnnouncement messages on StateMap and FileTransfer were causing some headache, and needed to be parsed separately.
* FileTransfer Unknown0 message is used to trigger getSources. See notes in code.

## To Be Implemented / Possibilities

* EventEmitter stuff isn't fully implemented yet, with a few exceptions (those needed for FileTransfer)

* FileTransfer has only been tested with DB.

* Some methods from Database.ts have been moved to FileTransfer. This isn't intended to be permanent, it was just to allow a demonstration of downloading a DB.

* TimeSyc.ts is in the project, but should be disregarded for now.

* We could possibly eliminate StageLinqDevices, as this step is no longer really necessary. Multiple devices are handled by single instances of each service.

* StageLinqListener and Announce could be reworked into a single class. Presently all StageLinqListener is doing is adding and updating a list of announced devices (StageLinqDevices.peers).

## Compatibility Notes

* This is **Experimental**. Do not use in a live setup, lots of further testing is required.
* That being said, I have tested it (Mac & PC) on my setup:
  * 2x SC6000 players running EngineOS 2.3.2
  * X1800 Mixer running 1.6 firmware
* Hoping Prime4 / Prime GO users could test and let me know how it works.

#

## Original ReadMe
# StageLinq

NodeJS library implementation to access information through the Denon StageLinq protocol.

# Features

* Tested with Denon two SC6000s, X1850, Prime 4, Prime 2, and Prime Go.
* Event emitters for state changes, tracks getting loaded, and current playing track.
* Event emitter for debug logging.
* Downloads source databases for you.
* You can implement handling the database yourself or use this library's BetterSqlite3 dependency.

---

## Usage

```ts
import { StageLinq } from '../StageLinq';

const options = { downloadDbSources: true };
const stageLinq = new StageLinq(options);

stageLinq.devices.on('ready', (connectionInfo) => {
  console.log(`Device ${connectionInfo.software.name} on ` +
    `${connectionInfo.address}:${connectionInfo.port} is ready.`);
});

stageLinq.devices.on('trackLoaded', (status) => {
  console.log(`"${status.title}" - ${status.artist} loaded on player ` +
    `${status.deck})`);
});

stageLinq.devices.on('nowPlaying', (status) => {
  console.log(`Now Playing: "${status.title}" - ${status.artist})`);
});
```

A [complete example](https://github.com/chrisle/StageLinq/blob/main/cli/index.ts) with all events and options can be found in the CLI.

---

## Overview

The idea behind this library is to have a structure something like this:

**StageLinq > Devices > Player > Deck**

A StageLinq sets up a device listener and a class that handles all the
devices (`StageLinqDevices`).

`StageLinqDevices` figures out if it wants to connect or not and handles
connections. There may be one or more device on the network. For each device it
will try to connect to it and subscribe to it's `StateMap`.

Currently there is only one type of device: `Player`. A `Player` may have up to
4 decks A, B, C, D (aka "layers"). The `Player` handles incoming messages,
parses them, groups them, and emits events. These events bubble up to the
`Device`.

## Database

You can use BetterSqlite3 bundled into this library or let this library
download the files for you, then choose your own Sqlite library to
query the database. See CLI example.

## Logging

I needed the logging to be used outside of the library so I made them events
that you can listen to.

* `error`: When something bad happens.
* `warn`: When something happens but doesn't affect anything.
* `info`/`log`: When we have something to say
* `debug`: Spits out the parsed version of the packets.
* `silly`: Dumps all kinds of internal stuff

## About

Forked from @MarByteBeep's code.

Additional reverse engineering work: https://github.com/chrisle/stagelinq-pcap

Used in my app Now Playing https://www.nowplaying2.com
