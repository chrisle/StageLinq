import { sleep } from './utils/sleep'
import { Controller } from './Controller'
import { announce, unannounce } from './announce'
import { FileTransfer, StateMap } from './services'
import * as sqlite3 from 'sqlite3'
import * as sqlite from 'sqlite'
import * as fs from 'fs';

require('console-stamp')(console, {
    format: ':date(HH:MM:ss) :label'
});

function makeDownloadPath(p_filepath: string) {
	const path = `./downloaded/${p_filepath}`;
	let paths = path.split(/[/\\]/).filter(e => e.length > 0);
	const filename = paths[paths.length-1];
	paths.pop();
	const newPath = paths.join('/');
	fs.mkdirSync(newPath, {recursive: true});
	return newPath + '/' + filename;
}

async function main() {
	const controller = new Controller();
	await controller.connect();

	const ftx = await controller.connectToService(FileTransfer);
	if (ftx) {
		const sources = await ftx.getSources();

		console.info("CONNECTED SOURCES", sources);
		for (const source of sources) {
			const file = await ftx.getFile(source.database.location);
			const filepath = makeDownloadPath(source.database.location);

			fs.writeFileSync(filepath, file);
			console.info(`downloaded: '${source.database.location}' and stored in '${filepath}''`);

			// Now query something from the database
			const db = await sqlite.open({
				filename: filepath,
				driver: sqlite3.Database
			});

			const result = await db.get('SELECT COUNT(*) as total FROM AlbumArt');
			console.info(`database contains ${result.total} album arts`);
		}
		ftx.disconnect();
	}

	await controller.connectToService(StateMap);

	// Endless loop
	while (true) {
		await sleep(250);
	}
}

(async () => {
	let returnCode = 0;
	try {
		process.on('SIGINT', async function() {
			console.info("... exiting");
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
		await main();
	} catch (err) {
		const message = err.stack.toString();
		console.error(message);
		returnCode = 1;
	}

	await unannounce();
	process.exit(returnCode);
})();
