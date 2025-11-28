export class Logger {
  constructor(namespace) {
    this.namespace = namespace;
  }

  log(message, ...args) {
    console.log(`[${this.namespace}]`, message, ...args);
  }

  error(message, ...args) {
    console.error(`[${this.namespace}]`, message, ...args);
  }

  warn(message, ...args) {
    console.warn(`[${this.namespace}]`, message, ...args);
  }
}

export const defaultLogger = new Logger("app");
