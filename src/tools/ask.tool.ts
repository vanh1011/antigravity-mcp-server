import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { EFFORTS, MODES } from '../constants.js';
import type { ServerConfig } from '../types.js';
import { commonParams, runAsk } from './runAsk.js';

export const ASK_TOOL = 'antigravity';

const inputSchema = {
  prompt: z.string().min(1).describe('The task or question for Antigravity.'),
  ...commonParams,
  effort: z.enum(EFFORTS).optional().describe('Reasoning effort.'),
  mode: z
    .enum(MODES)
    .optional()
    .describe(
      'accept-edits = may edit files (server default). plan = read-only. ' +
        'auto = also run commands, if the account supports it.',
    ),
  conversationId: z
    .string()
    .optional()
    .describe('Continue an earlier conversation. Use the id returned by a previous call.'),
  project: z.string().optional().describe('Antigravity project id or name.'),
  cwd: z
    .string()
    .optional()
    .describe('Directory agy works in. Defaults to the directory the server was started from.'),
  addDirs: z.array(z.string()).optional().describe('Extra directories to add to the workspace.'),
  sandbox: z.boolean().optional().describe('Run with terminal restrictions enabled.'),
};

export function registerAskTool(server: McpServer, config: ServerConfig): void {
  server.registerTool(
    ASK_TOOL,
    {
      title: 'Ask Antigravity',
      description:
        'Hand a task or question to the Antigravity CLI (agy) and return its answer. ' +
        'By default agy may edit files in the workspace; pass mode "plan" for a read-only answer. ' +
        'Pass the returned conversationId to continue the same conversation.',
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    (args, extra) => runAsk(config, args, extra, 'Antigravity is working'),
  );
}
