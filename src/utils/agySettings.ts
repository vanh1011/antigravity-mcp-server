import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ENV } from '../constants.js';
import { logger } from './logger.js';

/** Where the Antigravity CLI keeps its user settings. */
export function settingsPath(env: NodeJS.ProcessEnv = process.env): string {
  return env[ENV.SETTINGS] || join(homedir(), '.gemini', 'antigravity-cli', 'settings.json');
}

/**
 * Read `permissions.allow` from agy's settings. Only used to make error hints
 * more useful, so any problem just yields an empty list.
 */
export async function readAllowRules(path: string): Promise<string[]> {
  try {
    const settings = JSON.parse(await readFile(path, 'utf8')) as {
      permissions?: { allow?: unknown };
    };
    const allow = settings.permissions?.allow;
    return Array.isArray(allow) ? allow.filter((r): r is string => typeof r === 'string') : [];
  } catch (error) {
    logger.debug('could not read agy settings', path, error);
    return [];
  }
}
