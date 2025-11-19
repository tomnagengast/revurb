import fs from "node:fs/promises";
import path from "node:path";
import { file } from "bun";

// Ensure logs directory exists
const LOGS_DIR = path.resolve(import.meta.dir, "../logs");
await fs.mkdir(LOGS_DIR, { recursive: true });

// Create log file
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const logFilePath = path.join(LOGS_DIR, `server-${timestamp}.log`);
const logFile = file(logFilePath);
const writer = logFile.writer();

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function formatMessage(args: unknown[]) {
  return args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
    )
    .join(" ");
}

// Override console.log to write to file
console.log = (...args: unknown[]) => {
  const msg = formatMessage(args);
  const line = `[${new Date().toISOString()}] INFO: ${msg}\n`;
  writer.write(line);
  writer.flush();
  originalConsoleLog(...args);
};

// Override console.error to write to file
console.error = (...args: unknown[]) => {
  const msg = formatMessage(args);
  const line = `[${new Date().toISOString()}] ERROR: ${msg}\n`;
  writer.write(line);
  writer.flush();
  originalConsoleError(...args);
};

export const log = console.log;
export const error = console.error;

export function closeLogger() {
  writer.end();
}

log(`Logging to ${logFilePath}`);
