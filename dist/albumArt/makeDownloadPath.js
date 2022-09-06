"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeTempDownloadPath = void 0;
const fs = require("fs");
// import * as os from 'os';
function makeTempDownloadPath(p_path) {
    // const tmpPath = os.tmpdir();
    // TODO: This wont work for windows!
    // const path = `/${tmpPath}/localdb/${p_path}`;
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
exports.makeTempDownloadPath = makeTempDownloadPath;
//# sourceMappingURL=makeDownloadPath.js.map