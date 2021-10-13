import { sleep } from './utils/sleep';
import { Controller } from './Controller';
import { announce, unannounce } from './announce';
import { StateMap } from './services';

require('console-stamp')(console, {
    format: ':date(HH:MM:ss) :label'
});

async function main() {
	const controller = new Controller();
	await controller.connect();
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
