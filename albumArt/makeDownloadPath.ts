import * as fs from 'fs';


export function makeDownloadPath(p_path: string) {
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
