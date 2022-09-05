"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
require('console-stamp')(console, {
    format: ':date(HH:MM:ss) :label',
});
class Logger {
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
exports.Logger = Logger;
//# sourceMappingURL=LogEmitter.js.map