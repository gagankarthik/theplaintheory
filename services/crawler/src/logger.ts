/** Structured JSON-lines logger (one object per line → CloudWatch Logs Insights friendly). */

export type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

function serializeError(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  return value;
}

export function createLogger(base: Record<string, unknown> = {}, minLevel?: Level): Logger {
  const threshold = ORDER[minLevel ?? ((process.env.LOG_LEVEL as Level) || "info")] ?? ORDER.info;
  const write = (level: Level, msg: string, fields?: Record<string, unknown>) => {
    if (ORDER[level] < threshold) return;
    const entry: Record<string, unknown> = { ts: new Date().toISOString(), level, msg, ...base };
    if (fields) for (const [k, v] of Object.entries(fields)) entry[k] = serializeError(v);
    const line = JSON.stringify(entry);
    if (level === "error" || level === "warn") process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  };
  return {
    debug: (m, f) => write("debug", m, f),
    info: (m, f) => write("info", m, f),
    warn: (m, f) => write("warn", m, f),
    error: (m, f) => write("error", m, f),
    child: (fields) => createLogger({ ...base, ...fields }, minLevel),
  };
}

export const logger = createLogger({ service: "cmp-crawler" });
