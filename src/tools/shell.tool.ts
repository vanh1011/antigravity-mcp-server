import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ServerConfig } from '../types.js';
import { commonParams, runAsk } from './runAsk.js';

export const SHELL_TOOL = 'antigravity_shell';

export function buildShellPrompt(task: string, execute: boolean): string {
  if (!execute) {
    return [
      `Write the shell commands to do this: ${task}`,
      '',
      'Do not run anything. Give the commands in one code block, then explain in a line or two',
      'what each does and anything that could go wrong.',
    ].join('\n');
  }
  return [
    `Do this by running shell commands: ${task}`,
    '',
    'Run only what the task needs. Afterwards, list every command you ran with its exit status',
    'and the relevant output, and say whether the task succeeded.',
  ].join('\n');
}

export function registerShellTool(server: McpServer, config: ServerConfig): void {
  server.registerTool(
    SHELL_TOOL,
    {
      title: 'Shell commands with Antigravity',
      description:
        'Have Antigravity write shell commands for a task, or run them when execute is true. ' +
        'Running needs the "command" permission allowed in agy\'s settings.json; without it the ' +
        'tool returns a permission-denied error that names the rule to add.',
      inputSchema: {
        task: z.string().min(1).describe('What the commands should do.'),
        execute: z
          .boolean()
          .optional()
          .describe('false (default): only write the commands. true: run them.'),
        cwd: z
          .string()
          .optional()
          .describe('Directory to work in. Defaults to the directory the server was started from.'),
        ...commonParams,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    ({ task, execute = false, cwd, model, timeoutSec }, extra) =>
      runAsk(
        config,
        {
          prompt: buildShellPrompt(task, execute),
          model,
          timeoutSec,
          cwd,
          mode: execute ? 'accept-edits' : 'plan',
        },
        extra,
        execute ? 'Antigravity is running commands' : 'Antigravity is writing commands',
      ),
  );
}
