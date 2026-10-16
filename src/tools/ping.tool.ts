import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SERVER_NAME, SERVER_VERSION } from '../constants.js';
import { formatError } from '../errors.js';
import type { ServerConfig } from '../types.js';
import { checkBinary } from '../utils/agyExecutor.js';
import { errorResult, textResult } from './result.js';

export const PING_TOOL = 'antigravity_ping';

export function registerPingTool(server: McpServer, config: ServerConfig): void {
  server.registerTool(
    PING_TOOL,
    {
      title: 'Check Antigravity CLI',
      description:
        'Check that the server is up and the agy binary can be started. Does not use any quota.',
      inputSchema: { message: z.string().optional().describe('Text to echo back.') },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ message }) => {
      try {
        await checkBinary(config);
        return textResult(
          [
            message ? `pong: ${message}` : 'pong',
            `${SERVER_NAME} ${SERVER_VERSION}`,
            `agy binary: ${config.bin}`,
            `default model: ${config.defaultModel ?? 'agy default'}`,
            `default mode: ${config.defaultMode}`,
            `timeout: ${config.timeoutSec}s`,
          ].join('\n'),
        );
      } catch (error) {
        return errorResult(formatError(error));
      }
    },
  );
}
