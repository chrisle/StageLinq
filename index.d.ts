interface DiscoveryMessage {
	token: Uint8Array;
	source: string;
	action: string;
	software: {
		name: string;
		version: string;
	};
	port: number;
}

interface ServicePorts {
	[key: string]: number;
}

interface ServiceMessage<T> {
	id: number;
	message: T;
}

interface Source {
	name: string;
	database: {
		location: string;
		size: number;
	};
}

interface FileTransferInfo {
	txid: number;
	size: number;
}
