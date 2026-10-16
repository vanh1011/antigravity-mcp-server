import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ServerConfig } from '../types.js';
import { commonParams, runAsk } from './runAsk.js';

export const WEB_SEARCH_TOOL = 'antigravity_web_search';

export function buildWebSearchPrompt(query: string): string {
  return [
    `Search the web and answer: ${query}`,
    '',
    'Use current sources, not memory. Answer briefly, then list the URLs you used.',
    'If sources disagree or you could not find an answer, say so.',
    'Do not edit any files.',
  ].join('\n');
}

export function registerWebSearchTool(server: McpServer, config: ServerConfig): void {
  server.registerTool(
    WEB_SEARCH_TOOL,
    {
      title: 'Search the web with Antigravity',
      description:
        'Ask Antigravity to look something up on the web and answer with source URLs. Read-only. ' +
        'agy needs the "read_url" permission allowed in its settings.json; without it the tool ' +
        'returns a permission-denied error that names the rule to add.',
      inputSchema: {
        query: z.string().min(1).describe('What to look up.'),
        ...commonParams,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ query, model, timeoutSec }, extra) =>
      runAsk(
        config,
        { prompt: buildWebSearchPrompt(query), model, timeoutSec, mode: 'plan' },
        extra,
        'Antigravity is searching the web',
      ),
  );
}
