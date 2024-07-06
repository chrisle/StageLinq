"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const stream_1 = require("stream");
class Logger extends stream_1.EventEmitter {
    static get instance() {
        return this._instance || (this._instance = new this());
    }
    static log(...args) {
        Logger.instance.emit('log', ...args);
        Logger.instance.emit('any', ...args);
    }
    static error(...args) {
        Logger.instance.emit('error', ...args);
        Logger.instance.emit('any', ...args);
    }
    static warn(...args) {
        Logger.instance.emit('warn', ...args);
        Logger.instance.emit('any', ...args);
    }
    static info(...args) {
        Logger.instance.emit('info', ...args);
        Logger.instance.emit('any', ...args);
    }
    static debug(...args) {
        Logger.instance.emit('debug', ...args);
        Logger.instance.emit('any', ...args);
    }
    static silly(...args) {
        Logger.instance.emit('silly', ...args);
        Logger.instance.emit('any', ...args);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=index.js.map