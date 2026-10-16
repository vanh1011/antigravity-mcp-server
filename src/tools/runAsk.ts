import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DEFAULTS } from '../constants.js';
import { formatError } from '../errors.js';
import type { AskOptions, AskResult, ServerConfig } from '../types.js';
import { ask } from '../utils/agyExecutor.js';
import { startHeartbeat, type ToolExtra } from '../utils/progress.js';
import { errorResult, textResult } from './result.js';

/** Parameters every prompt-based tool accepts. */
export const commonParams = {
  model: z
    .string()
    .optional()
    .describe('Model id, e.g. "gemini-3.8-flash-high". Run antigravity_models for the list.'),
  timeoutSec: z
    .number()
    .int()
    .positive()
    .max(DEFAULTS.MAX_TIMEOUT_SEC)
    .optional()
    .describe('Give up after this many seconds. Partial output is returned if any.'),
};

export type AskOverrides = Partial<Omit<AskOptions, 'prompt'>> & { prompt: string };

function footer(result: AskResult, opts: AskOptions): string {
  const lines = [
    `conversationId: ${result.conversationId || 'n/a'}`,
    `model: ${opts.model ?? 'agy default'}`,
    `mode: ${opts.mode}`,
  ];
  if (result.durationSeconds !== undefined) {
    lines.push(`duration: ${result.durationSeconds.toFixed(1)}s`);
  }
  if (result.totalTokens !== undefined) lines.push(`tokens: ${result.totalTokens}`);
  if (result.partial) lines.push('note: timed out, response is partial');
  for (const note of result.notes) lines.push(`agy: ${note}`);
  return lines.join('\n');
}

/**
 * Run one agy call for a tool: fill in server defaults, keep the client informed
 * with progress, and turn the outcome into an MCP tool result.
 */
export async function runAsk(
  config: ServerConfig,
  overrides: AskOverrides,
  extra: ToolExtra,
  label: string,
): Promise<CallToolResult> {
  const opts: AskOptions = {
    ...overrides,
    model: overrides.model ?? config.defaultModel,
    effort: overrides.effort ?? config.defaultEffort,
    mode: overrides.mode ?? config.defaultMode,
    timeoutSec: overrides.timeoutSec ?? config.timeoutSec,
  };
  const stopHeartbeat = startHeartbeat(extra, label);
  try {
    const result = await ask(config, opts, extra.signal);
    return textResult(`${result.response.trim()}\n\n---\n${footer(result, opts)}`);
  } catch (error) {
    return errorResult(formatError(error));
  } finally {
    stopHeartbeat();
  }
}
