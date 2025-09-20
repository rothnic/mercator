type LogMeta = Record<string, unknown> | undefined;

const hasMeta = (meta: LogMeta): meta is Record<string, unknown> =>
  Boolean(meta && Object.keys(meta).length > 0);

const logWithLevel = (level: 'info' | 'warn' | 'error', message: string, meta: LogMeta) => {
  const prefix = `[Mercator] ${message}`;
  const args: unknown[] = hasMeta(meta) ? [prefix, meta] : [prefix];

  if (level === 'info') {
    console.info(...args);
  } else if (level === 'warn') {
    console.warn(...args);
  } else {
    console.error(...args);
  }
};

export interface ServiceLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export const createConsoleLogger = (): ServiceLogger => ({
  info: (message, meta) => logWithLevel('info', message, meta),
  warn: (message, meta) => logWithLevel('warn', message, meta),
  error: (message, meta) => logWithLevel('error', message, meta)
});

export const serializeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    const serialized: Record<string, unknown> = {
      name: error.name,
      message: error.message
    };

    if (error.stack) {
      serialized.stack = error.stack;
    }

    return serialized;
  }

  return { message: String(error) };
};
