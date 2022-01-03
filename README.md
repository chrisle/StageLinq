# StageLinq
NodeJS library implementation to access information through the Denon StageLinq protocol. This code is tested on Engine OS v1.6.2 and v2.0.0.

## About

This is a WIP demo that tries to find a Denon Stagelinq device (e.g., Prime4, Prime2 and Prime Go) on the local network, connects with it and outputs all input a user makes.

## Thanks

Big thanks to @erikrichardlarson and specifically @icedream for his [Go reference code](https://github.com/icedream/go-stagelinq) upon which this code is based.

## Prerequisites

This code is built and tested on 
```
node v14.16.0
npm v6.14.11
tsc v4.3.5
engine os v1.6.2 to v2.1.1
```

Ensure typescript is installed, if not run the following

```bash
npm install -g typescript
```



## Install NPM Modules

To fetch all required NPM modules, run the following command from the terminal

```bash
npm install
```

## Build & Run

### Visual Studio Code

* Load `stagelinq.code-workspace` in VS Code
* Run `launch` from the debug tab

### Command line Build

```bash
tsc --build tsconfig.json
```

### Command line Run

```bash
node ./dist/main.js
```



