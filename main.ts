import { sleep } from './utils/sleep';
import { Controller } from './Controller';
import { announce, unannounce } from './announce';
import { StateData } from './services/StateMap';

require('console-stamp')(console, {
    format: ':date(HH:MM:ss) :label'
});

async function main() {
	const controller = new Controller();
	await controller.connect();
	await controller.connectToService("StateMap", (p_data: StateData) =>  {
		console.log(`${p_data.name} => ${JSON.stringify(p_data.json)}`);
	});

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
			try {
				await unannounce();
			} catch {} // Ensure SIGINT won't be impeded by some error
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
