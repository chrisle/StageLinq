"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CliLogger = void 0;
require('console-stamp')(console, {
    format: ':date(HH:MM:ss) :label',
});
class CliLogger {
    static get instance() {
        return this._instance || (this._instance = new this());
    }
    static info(...args) {
        console.info(...args);
    }
    static log(...args) {
        console.log(...args);
    }
    static debug(...args) {
        console.debug(...args);
    }
    static warn(...args) {
        console.warn(...args);
    }
    static error(...args) {
        console.error(...args);
    }
}
exports.CliLogger = CliLogger;
//# sourceMappingURL=CliLogger.js.map