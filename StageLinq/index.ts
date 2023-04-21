import { Discovery } from '../Discovery';
import { Logger } from '../LogEmitter';
import { ActingAsDevice, StageLinqOptions, DeviceId } from '../types';
import { Devices } from '../devices'
import { Sources } from '../Sources';
import { Service, Directory } from '../services';
import { Status } from '../status';


const DEFAULT_OPTIONS: StageLinqOptions = {
	actingAs: ActingAsDevice.StageLinqJS,
	downloadDbSources: true,
};

/**
 * Main StageLinq static class.
 */
export class StageLinq {
	private static _options: StageLinqOptions = DEFAULT_OPTIONS;
	readonly logger: Logger = Logger.instance;
	private static _discovery: Discovery = null;
	private static _devices: Devices = null;
	private static _sources: Sources = null;
	private static _status: Status = null;
	private static _directory: Directory = null;

	constructor(options?: StageLinqOptions,) {
		StageLinq._options = options || DEFAULT_OPTIONS;
		StageLinq._discovery = new Discovery();
		StageLinq._devices = new Devices();
		StageLinq._sources = new Sources();
		StageLinq._status = new Status();
	}

	static get options() {
		return this._options
	}

	static get discovery() {
		return this._discovery
	}

	static get devices() {
		return this._devices
	}

	static get sources() {
		return this._sources
	}

	static get status() {
		return this._status
	}

	static get directory() {
		return this._directory
	}

	private static set directory(service: Directory) {
		StageLinq._directory = service;
	}


	/**
	 * Service Constructor Factory Function
	 * @param {Service<T>} Service
	 * @param {DeviceId} [deviceId]
	 * @returns {Promise<Service<T>>}
	 */
	static async startServiceListener<T extends InstanceType<typeof Service>>(ctor: {
		new(_deviceId?: DeviceId): T;
	}, deviceId?: DeviceId): Promise<T> {
		const service = new ctor(deviceId);

		await service.start();
		return service;
	}

	/**
	 * Connect to the StageLinq network.
	 */
	async connect() {
		//  Initialize Discovery agent
		StageLinq.discovery.listen(StageLinq.options.actingAs);

		//Directory is required
		StageLinq.directory = await StageLinq.startServiceListener(Directory);

		//  Announce myself with Directory port
		await StageLinq.discovery.announce(StageLinq.directory.serverInfo.port);
	}

	/**
	 * Disconnect from the StageLinq network.
	 * Close all open Servers
	 */
	async disconnect() {
		try {
			Logger.warn('disconnecting');
			await StageLinq.directory.stop();
			const services = await StageLinq.devices.getDeviceServices();
			for (const service of services) {
				console.log(`closing ${service.name} on ${service.deviceId.string}`);
				await service.stop()
			}
			await StageLinq.discovery.unannounce();
		} catch (e) {
			throw new Error(e);
		}
	}
}