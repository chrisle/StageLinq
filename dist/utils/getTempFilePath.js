"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTempFilePath = void 0;
const fs = require("fs");
const os = require("os");
const path = require("path");
/**
 * Recursively create a directory under the OS's temp path.
 *
 * @param p_path Directory to create including filename
 * @returns Absolute path
 */
function getTempFilePath(p_path) {
    const tmpPath = `/${os.tmpdir()}/localdb/${p_path}`.replace('net://', '');
    let paths = tmpPath.split(/[/\\]/).filter((e) => e.length > 0);
    const isFolder = p_path.endsWith('/') || p_path.endsWith('\\');
    let filename = '';
    if (isFolder === false) {
        filename = paths[paths.length - 1];
        paths.pop();
    }
    const newPath = paths.join('/');
    fs.mkdirSync(path.resolve('/', newPath), { recursive: true });
    return path.resolve('/', newPath, filename);
}
exports.getTempFilePath = getTempFilePath;
//# sourceMappingURL=getTempFilePath.js.map