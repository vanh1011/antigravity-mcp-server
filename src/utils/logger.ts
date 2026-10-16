import { ENV, SERVER_NAME } from '../constants.js';

// stdout carries the MCP protocol, so every log line goes to stderr.
const debugEnabled = () => process.env[ENV.DEBUG] === '1' || process.env[ENV.DEBUG] === 'true';

export const logger = {
  debug(...args: unknown[]) {
    if (debugEnabled()) console.error(`[${SERVER_NAME}]`, ...args);
  },
  error(...args: unknown[]) {
    console.error(`[${SERVER_NAME}]`, ...args);
  },
};
