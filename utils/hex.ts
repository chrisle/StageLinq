// Based on https://www.npmjs.com/package/hex
const zero = function (n: number, max: number) {
	let str = n.toString(16).toUpperCase();
	while (str.length < max) {
		str = '0' + str;
	}
	return str;
};

export function hex(p_buffer: Uint8Array, p_columns: number = 16) {
	const rows = Math.ceil(p_buffer.length / p_columns);
	const last = p_buffer.length % p_columns || p_columns;
	let offsetLength = p_buffer.length.toString(16).length;
	if (offsetLength < 6) offsetLength = 6;

	let str = 'Offset';
	while (str.length < offsetLength) {
		str += ' ';
	}

	str = '\u001b[36m' + str + '  ';

	for (let i = 0; i < p_columns; i++) {
		str += ' ' + zero(i, 2);
	}

	str += '\u001b[0m';
	if (p_buffer.length) str += '\n';

	let b = 0;
	let lastBytes: number;
	let lastSpaces: number;
	let v: number;

	for (let i = 0; i < rows; i++) {
		str += '\u001b[36m' + zero(b, offsetLength) + '\u001b[0m  ';
		lastBytes = i === rows - 1 ? last : p_columns;
		lastSpaces = p_columns - lastBytes;

		for (let j = 0; j < lastBytes; j++) {
			str += ' ' + zero(p_buffer[b], 2);
			b++;
		}

		for (let j = 0; j < lastSpaces; j++) {
			str += '   ';
		}

		b -= lastBytes;
		str += '   ';

		for (let j = 0; j < lastBytes; j++) {
			v = p_buffer[b];
			str += (v > 31 && v < 127) || v > 159 ? String.fromCharCode(v) : '.';
			b++;
		}

		str += '\n';
	}

	process.stdout.write(str);
}
