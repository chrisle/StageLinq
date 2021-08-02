type DiscoveryMessage = {
	token: Uint8Array,
	source: string,
	action: string,
	software: {
		name: string,
		version: string,
	},
	port: number
};

interface ServicePorts {
	[key: string]: number;
}

type MessageHandler = (p_data: object) => void;