"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeDownloadPath = void 0;
const fs = require("fs");
function makeDownloadPath(p_path) {
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
exports.makeDownloadPath = makeDownloadPath;
//# sourceMappingURL=makeDownloadPath.js.map