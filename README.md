# StageLinq

NodeJS library implementation to access information through the Denon StageLinq protocol.

# Features

* Tested with Denon two SC6000s, X1850, Prime 4, Prime 2, and Prime Go.
* Event emitters for state changes, tracks getting loaded, and current playing track.
* Event emitter for debug logging.

---

## Usage

See a complete example in /cli/index.ts

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
