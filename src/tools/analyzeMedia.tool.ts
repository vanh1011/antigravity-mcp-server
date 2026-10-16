import { stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { AgyError, formatError } from '../errors.js';
import type { ServerConfig } from '../types.js';
import { errorResult } from './result.js';
import { commonParams, runAsk } from './runAsk.js';

export const ANALYZE_MEDIA_TOOL = 'antigravity_analyze_media';

/** Resolve paths against the server's working directory and make sure each is a file. */
export async function resolveFiles(filePaths: string[]): Promise<string[]> {
  const resolved = filePaths.map((p) => resolve(p));
  for (const file of resolved) {
    const info = await stat(file).catch(() => undefined);
    if (!info?.isFile()) {
      throw new AgyError('invalid-input', `File not found: ${file}`);
    }
  }
  return resolved;
}

export function buildMediaPrompt(files: string[], prompt: string): string {
  return [
    'Open and look at these files:',
    ...files.map((f) => `- ${f}`),
    '',
    prompt,
    '',
    'Base your answer only on what is in the files. Do not edit any files.',
  ].join('\n');
}

export function registerAnalyzeMediaTool(server: McpServer, config: ServerConfig): void {
  server.registerTool(
    ANALYZE_MEDIA_TOOL,
    {
      title: 'Analyze images and PDFs with Antigravity',
      description:
        'Have Antigravity read images, screenshots or PDFs and answer a question about them. Read-only.',
      inputSchema: {
        filePaths: z
          .array(z.string().min(1))
          .min(1)
          .describe('Files to look at. Relative paths are resolved from the server directory.'),
        prompt: z
          .string()
          .min(1)
          .describe('What to find out, e.g. "What error is shown?" or "List the invoice totals".'),
        ...commonParams,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ filePaths, prompt, model, timeoutSec }, extra) => {
      let files: string[];
      try {
        files = await resolveFiles(filePaths);
      } catch (error) {
        return errorResult(formatError(error));
      }
      const dirs = [...new Set(files.map((f) => dirname(f)))];
      return runAsk(
        config,
        {
          prompt: buildMediaPrompt(files, prompt),
          model,
          timeoutSec,
          mode: 'plan',
          cwd: dirs[0],
          addDirs: dirs.slice(1),
        },
        extra,
        'Antigravity is reading the files',
      );
    },
  );
}
