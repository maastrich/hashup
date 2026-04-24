export type LogLevel = "silent" | "warn" | "info" | "debug";

export interface Logger {
  warn(message: string, error?: unknown): void;
  info(message: string): void;
  debug(message: string): void;
}

const ORDER: Record<LogLevel, number> = {
  silent: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Create a logger that writes to stderr at or below the given level.
 *
 * Defaults to `silent` so that `hashup()` never chatters at programmatic
 * callers — opt in explicitly when running from the CLI or when
 * debugging dependency-graph issues.
 */
export function createLogger(level: LogLevel = "silent"): Logger {
  const threshold = ORDER[level];
  return {
    warn(message, error) {
      if (threshold < ORDER.warn) return;
      if (error !== undefined) {
        process.stderr.write(`${message} ${formatError(error)}\n`);
        return;
      }
      process.stderr.write(`${message}\n`);
    },
    info(message) {
      if (threshold < ORDER.info) return;
      process.stderr.write(`${message}\n`);
    },
    debug(message) {
      if (threshold < ORDER.debug) return;
      process.stderr.write(`${message}\n`);
    },
  };
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
}

export function isLogLevel(value: string): value is LogLevel {
  return value === "silent" || value === "warn" || value === "info" || value === "debug";
}
