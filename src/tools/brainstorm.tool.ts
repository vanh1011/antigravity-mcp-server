import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ServerConfig } from '../types.js';
import { commonParams, runAsk } from './runAsk.js';

export const BRAINSTORM_TOOL = 'antigravity_brainstorm';

export const METHODS = {
  open: 'Generate a wide range of ideas, from safe to unusual.',
  scamper:
    'Use SCAMPER: Substitute, Combine, Adapt, Modify, Put to another use, Eliminate, Reverse. Label each idea with its letter.',
  'design-thinking':
    'Start from who the users are and what they struggle with, then propose ideas that address those needs.',
  'first-principles':
    'Strip the problem down to its basic facts and constraints, then build ideas up from those.',
  'six-hats':
    'Look at the topic through the six thinking hats (facts, feelings, risks, benefits, creativity, process) and give ideas from each.',
  reverse:
    'First list ways to make the problem worse, then turn each one around into an idea that makes it better.',
} as const;

export type Method = keyof typeof METHODS;

export function buildBrainstormPrompt(
  topic: string,
  method: Method,
  ideas: number,
  context?: string,
): string {
  const lines = [`Brainstorm about: ${topic}`];
  if (context) lines.push(`Context: ${context}`);
  lines.push(
    '',
    `Method: ${METHODS[method]}`,
    `Give ${ideas} distinct ideas. For each: a short title, one or two sentences on the idea,`,
    'and a rough effort level (low, medium, high).',
    'End with the two or three ideas you would try first, and why.',
    'Do not edit any files.',
  );
  return lines.join('\n');
}

export function registerBrainstormTool(server: McpServer, config: ServerConfig): void {
  server.registerTool(
    BRAINSTORM_TOOL,
    {
      title: 'Brainstorm with Antigravity',
      description:
        'Have Antigravity generate ideas on a topic using a chosen method, and pick the most promising ones. Read-only.',
      inputSchema: {
        topic: z.string().min(1).describe('What to brainstorm about.'),
        method: z
          .enum(Object.keys(METHODS) as [Method, ...Method[]])
          .optional()
          .describe(
            'open (default), scamper, design-thinking, first-principles, six-hats or reverse.',
          ),
        ideas: z.number().int().min(3).max(30).optional().describe('How many ideas (default 8).'),
        context: z
          .string()
          .optional()
          .describe('Background: constraints, audience, what has been tried.'),
        ...commonParams,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ topic, method = 'open', ideas = 8, context, model, timeoutSec }, extra) =>
      runAsk(
        config,
        {
          prompt: buildBrainstormPrompt(topic, method, ideas, context),
          model,
          timeoutSec,
          mode: 'plan',
        },
        extra,
        'Antigravity is brainstorming',
      ),
  );
}
