
require('console-stamp')(console, {
  format: ':date(HH:MM:ss) :label',
});

export class Logger {

  private static _instance: Logger;

  static get instance() {
    return this._instance || (this._instance = new this());
  }

  static info(...args: any) {
    console.info(...args);
  }

  static log(...args: any) {
    console.log(...args);
  }

  static debug(...args: any) {
    console.debug(...args);
  }

  static warn(...args: any) {
    console.warn(...args);
  }

  static error(...args: any) {
    console.error(...args);
  }

}