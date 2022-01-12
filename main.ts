//import { strict as assert } from 'assert';
//import { Controller } from './Controller';
import { sleep } from './utils/sleep';
import { announce, unannounce } from './announce';

//import minimist = require('minimist');
import { ConnectionInfo, Listener } from './Listener';
import { ControllerMgr } from './ControllerMgr';

require('console-stamp')(console, {
	format: ':date(HH:MM:ss) :label',
});

/*
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
*/

async function main() {
	//const args = minimist(process.argv.slice(2));

	const mgr = new ControllerMgr();

	const detected = function (p_id: number, p_info: ConnectionInfo) {
		console.info(
			`Found '${p_info.source}' Controller with ID '${p_id}' at '${p_info.address}:${p_info.port}' with following software:`,
			p_info.software
		);

		mgr.createController(p_id, p_info);
	};
	const lost = function (p_id: number) {
		console.info(`Controller with ID '${p_id}' is lost`);
		mgr.destroyController(p_id);
	};

	const listener = new Listener(detected, lost);

	// Main, infinite loop
	while (true) {
		const dt = 250; // fixed timestep
		await sleep(dt);
		listener.update(dt);
		mgr.update(dt);
	}

	/*
	const controller = new Controller();
	await controller.connect();

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


	*/

	// Endless loop
	while (true) {
		await sleep(250);
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

		await announce();

		// FIXME: main should be called when we found a device; not after waiting some random amount of time
		await sleep(500);
		await main();
	} catch (err) {
		const message = err.stack.toString();
		console.error(message);
		returnCode = 1;
	}

	await unannounce();
	process.exit(returnCode);
})();
