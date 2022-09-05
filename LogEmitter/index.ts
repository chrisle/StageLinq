import { EventEmitter } from 'stream';

export declare interface Logger {
  on(event: 'log', listener: (...args: any) => void): this;
  on(event: 'error', listener: (...args: any) => void): this;
  on(event: 'warn', listener: (...args: any) => void): this;
  on(event: 'info', listener: (...args: any) => void): this;
  on(event: 'debug', listener: (...args: any) => void): this;
  on(event: 'silly', listener: (...args: any) => void): this;
  on(event: 'any', listener: (...args: any) => void): this;
}

export class Logger extends EventEmitter {

  private static _instance: Logger;

  static get instance() {
    return this._instance || (this._instance = new this());
  }

  static log(...args: any) {
    Logger.instance.emit('log', ...args);
    Logger.instance.emit('any', ...args);
  }

  static error(...args: any) {
    Logger.instance.emit('error', ...args);
    Logger.instance.emit('any', ...args);
  }

  static warn(...args: any) {
    Logger.instance.emit('warn', ...args);
    Logger.instance.emit('any', ...args);
  }

  static info(...args: any) {
    Logger.instance.emit('info', ...args);
    Logger.instance.emit('any', ...args);
  }

  static debug(...args: any) {
    Logger.instance.emit('debug', ...args);
    Logger.instance.emit('any', ...args);
  }

  static silly(...args: any) {
    Logger.instance.emit('silly', ...args);
    Logger.instance.emit('any', ...args);
  }

}