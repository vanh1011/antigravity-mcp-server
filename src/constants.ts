import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

export const SERVER_NAME = 'antigravity-mcp-server';
export const SERVER_VERSION = pkg.version;

/** Execution modes accepted by `agy --mode`. */
export const MODES = ['plan', 'accept-edits', 'auto'] as const;

/** Reasoning effort levels accepted by `agy --effort`. */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

export const ENV = {
  BIN: 'AGY_BIN',
  MODEL: 'AGY_DEFAULT_MODEL',
  EFFORT: 'AGY_DEFAULT_EFFORT',
  MODE: 'AGY_DEFAULT_MODE',
  TIMEOUT: 'AGY_TIMEOUT_SEC',
  DEBUG: 'AGY_MCP_DEBUG',
} as const;

export const DEFAULTS = {
  BIN: 'agy',
  MODE: 'accept-edits',
  TIMEOUT_SEC: 600,
  MAX_TIMEOUT_SEC: 3600,
  /** Extra time agy gets after its own --print-timeout before we kill it. */
  KILL_GRACE_MS: 30_000,
  /** How often a progress notification is sent while agy is running. */
  PROGRESS_INTERVAL_MS: 20_000,
} as const;
