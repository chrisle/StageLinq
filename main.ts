import { announce, unannounce } from './announce';
import { Controller } from './Controller';
import { DenonDeviceListener } from './DenonDeviceListener';
import { FileTransfer, StateMap } from './services';
import { sleep } from './utils/sleep';
import { strict as assert } from 'assert';
import * as fs from 'fs';
import minimist = require('minimist');

require('console-stamp')(console, {
	format: ':date(HH:MM:ss) :label',
});

function makeDownloadPath(p_path: string) {
	const path = `./localdb/${p_path}`;
	let paths = path.split(/[/\\]/).filter((e) => e.length > 0);
	const isFolder = p_path.endsWith('/') || p_path.endsWith('\\');
	let filename = '';
	if (isFolder === false) {
		filename = paths[paths.length - 1];
		paths.pop();
	}
	const newPath = paths.join('/');
	fs.mkdirSync(newPath, { recursive: true });
	return newPath + ('/' + filename);
}

async function main() {
	// Start announcing ourselves.
	await announce();

	// Listen for new devices on the network.
	const listener = new DenonDeviceListener();

	// When a new device is found connect to it, ask it what services it offers,
	// and connect to a service.
	listener.onDeviceDiscovered(async (device) => {
		console.log(`New device discovered: "${device.source}" => ${device.address}:${device.port} ${JSON.stringify(device.software)}`);
		const controller = new Controller(device);
		await controller.connect();
		await maybeDownloadFiles(controller);
		await controller.connectToService(StateMap);
	});

	while (true) {
		await sleep(250);
	}
}

async function maybeDownloadFiles(controller: Controller) {
	const args = minimist(process.argv.slice(2));
	if (!args.disableFileTransfer) {
		const ftx = await controller.connectToService(FileTransfer);
		assert(ftx);
		const sources = await ftx.getSources();
		{
			const sync = !args.skipsync;
			for (const source of sources) {
				const dbPath = makeDownloadPath(source.database.location);
				// FIXME: Move all this away from main
				if (sync) {
					const file = await ftx.getFile(source.database.location);
					fs.writeFileSync(dbPath, file);
					console.info(`downloaded: '${source.database.location}' and stored in '${dbPath}'`);
				}
				await controller.addSource(source.name, dbPath, makeDownloadPath(`${source.name}/Album Art/`));

				if (sync) {
					await controller.dumpAlbumArt(source.name);
				}
			}
			ftx.disconnect();
		}
	}
}

(async () => {
	let returnCode = 0;
	try {
		process.on('SIGINT', async function () {
			console.info('... exiting');
			// Ensure SIGINT won't be impeded by some error
			try {
				await unannounce();
			} catch (err) {
				const message = err.stack.toString();
				console.error(message);
			}
			process.exit(returnCode);
		});

		// Start up!
		await main();

	} catch (err) {
		const message = err.stack.toString();
		console.error(message);
		returnCode = 1;
	}

	await unannounce();
	process.exit(returnCode);
})();
