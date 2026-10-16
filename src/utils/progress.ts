import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import { DEFAULTS } from '../constants.js';
import { logger } from './logger.js';

export type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/**
 * Send periodic progress notifications while a long call runs, so clients that
 * reset their timeout on progress keep waiting. Does nothing if the client did
 * not ask for progress. Returns a function that stops the heartbeat.
 */
export function startHeartbeat(
  extra: ToolExtra,
  label: string,
  intervalMs: number = DEFAULTS.PROGRESS_INTERVAL_MS,
): () => void {
  const progressToken = extra._meta?.progressToken;
  if (progressToken === undefined) return () => {};

  const startedAt = Date.now();
  let tick = 0;
  const timer = setInterval(() => {
    tick += 1;
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    extra
      .sendNotification({
        method: 'notifications/progress',
        params: { progressToken, progress: tick, message: `${label} (${elapsed}s)` },
      })
      .catch((err: unknown) => logger.debug('progress notification failed', err));
  }, intervalMs);

  return () => clearInterval(timer);
}
