import { DEFAULTS, EFFORTS, ENV, MODES } from './constants.js';
import { ConfigError } from './errors.js';
import type { Effort, Mode, ServerConfig } from './types.js';
import { settingsPath } from './utils/agySettings.js';

function pick<T extends string>(
  name: string,
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  if (!value) return undefined;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new ConfigError(`${name}="${value}" is not valid. Use one of: ${allowed.join(', ')}.`);
}

/** Read server settings from environment variables. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const rawTimeout = env[ENV.TIMEOUT];
  let timeoutSec: number = DEFAULTS.TIMEOUT_SEC;
  if (rawTimeout) {
    timeoutSec = Number(rawTimeout);
    if (!Number.isInteger(timeoutSec) || timeoutSec <= 0 || timeoutSec > DEFAULTS.MAX_TIMEOUT_SEC) {
      throw new ConfigError(
        `${ENV.TIMEOUT}="${rawTimeout}" must be a whole number of seconds between 1 and ${DEFAULTS.MAX_TIMEOUT_SEC}.`,
      );
    }
  }

  return {
    bin: env[ENV.BIN] || DEFAULTS.BIN,
    defaultModel: env[ENV.MODEL] || undefined,
    defaultEffort: pick<Effort>(ENV.EFFORT, env[ENV.EFFORT], EFFORTS),
    defaultMode: pick<Mode>(ENV.MODE, env[ENV.MODE], MODES) ?? DEFAULTS.MODE,
    timeoutSec,
    settingsPath: settingsPath(env),
  };
}
