import { ENV } from './constants.js';

export type AgyErrorKind =
  | 'not-found'
  | 'failed'
  | 'permission-denied'
  | 'timeout'
  | 'cancelled'
  | 'bad-output'
  | 'invalid-input';

/** A failure while running the Antigravity CLI. */
export class AgyError extends Error {
  constructor(
    readonly kind: AgyErrorKind,
    message: string,
    readonly details?: string,
    /** Overrides the generic hint for this kind. */
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'AgyError';
  }
}

/** Invalid server configuration, reported at startup. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const HINTS: Record<AgyErrorKind, string> = {
  'not-found': `Install the Antigravity CLI and make sure \`agy\` is on PATH, or point ${ENV.BIN} at the binary.`,
  failed: 'Check the message above. `antigravity_models` lists valid model ids.',
  'permission-denied':
    'Allow the permission with a rule under `permissions.allow` in the settings.json that agy mentions above.',
  timeout: 'Raise `timeoutSec` for this call, or set a larger default with AGY_TIMEOUT_SEC.',
  cancelled: 'The request was cancelled by the client.',
  'bad-output':
    'agy printed something that was not JSON. Run the same command in a terminal to see why.',
  'invalid-input': 'Fix the arguments and call the tool again.',
};

/**
 * Build the hint for a denied permission from agy's own message, which looks like:
 * `a tool required the "read_url" permission ... (e.g. read_url(<target>))`.
 */
export function permissionHint(stderr: string): string {
  const permission = /required the "([^"]+)" permission/.exec(stderr)?.[1];
  if (!permission) return HINTS['permission-denied'];
  return (
    `agy needs the "${permission}" permission. To allow it, add a rule such as ` +
    `\`${permission}(<target>)\` to \`permissions.allow\` in agy's settings.json ` +
    '(usually ~/.gemini/antigravity-cli/settings.json), then call the tool again. ' +
    'Keep the rule as narrow as you can.'
  );
}

/** Turn any thrown value into a readable message for the MCP client. */
export function formatError(error: unknown): string {
  if (error instanceof AgyError) {
    const parts = [`Antigravity error (${error.kind}): ${error.message}`];
    if (error.details) parts.push(error.details.trim());
    parts.push(`Hint: ${error.hint ?? HINTS[error.kind]}`);
    return parts.join('\n\n');
  }
  if (error instanceof Error) return `Unexpected error: ${error.message}`;
  return `Unexpected error: ${String(error)}`;
}
