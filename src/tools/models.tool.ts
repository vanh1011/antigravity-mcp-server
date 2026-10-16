import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { formatError } from '../errors.js';
import type { ServerConfig } from '../types.js';
import { listModels } from '../utils/agyExecutor.js';
import { errorResult, textResult } from './result.js';

export const MODELS_TOOL = 'antigravity_models';

export function registerModelsTool(server: McpServer, config: ServerConfig): void {
  server.registerTool(
    MODELS_TOOL,
    {
      title: 'List Antigravity models',
      description:
        'List the models your Antigravity plan can use. Pass an id as `model` to the antigravity tool.',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (extra) => {
      try {
        const models = await listModels(config, extra.signal);
        if (models.length === 0) return textResult('agy returned no models.');
        const lines = models.map((m) => `- \`${m.id}\` — ${m.name}`);
        if (config.defaultModel) lines.push('', `Server default: \`${config.defaultModel}\``);
        return textResult(lines.join('\n'));
      } catch (error) {
        return errorResult(formatError(error));
      }
    },
  );
}
