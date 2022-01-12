import { strict as assert } from 'assert';
import { Controller } from './Controller';
import { ConnectionInfo } from './Listener';
import { StateMap } from './services';

type ControllerList = {
	[key: string]: Controller;
};

export class ControllerMgr {
	private controllers: ControllerList = {};

	constructor() {}

	public async createController(p_id: number, p_info: ConnectionInfo): Promise<Controller> {
		assert(!this.controllers[p_id]);
		const controller = new Controller(p_id, p_info);
		this.controllers[p_id] = controller;

		// FIXME: Do we need to connect to controller in 'create' as well?
		const servicePorts = await controller.connect();

		// FIXME: Come up with some logic to have more control over which services I want to connect to for specific controllers
		if (servicePorts.StateMap) {
			await controller.connectToService(StateMap);
		}

		// FIXME: Disabled for now
		/*
		if (servicePorts.FileTransfer) {
			await controller.connectToService(FileTransfer);
		}
		*/
		return controller;
	}

	public async destroyController(p_id: number) {
		if (this.controllers[p_id]) {
			this.controllers[p_id].disconnect();
			delete this.controllers[p_id];
		}
	}

	public update(p_elapsedTime: number) {
		p_elapsedTime;
	}
}
