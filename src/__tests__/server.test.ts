import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import { createServer } from '../server.js';
import type { ServerConfig } from '../types.js';

const FAKE_AGY = fileURLToPath(new URL('./fixtures/fake-agy.mjs', import.meta.url));

// Real defaults, pointed at the fake agy.
const baseConfig: ServerConfig = { ...loadConfig({}), bin: FAKE_AGY, timeoutSec: 30 };

let client: Client | undefined;

async function connect(config: Partial<ServerConfig> = {}): Promise<Client> {
  const server = createServer({ ...baseConfig, ...config });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientSide);
  return client;
}

async function call(c: Client, name: string, args: Record<string, unknown> = {}) {
  const result = (await c.callTool({ name, arguments: args })) as CallToolResult;
  const first = result.content[0];
  return { isError: result.isError === true, text: first?.type === 'text' ? first.text : '' };
}

/** The fake agy echoes its argv and cwd as the response; pull them back out. */
function echoed(text: string): { args: string[]; cwd: string; prompt: string } {
  const { args, cwd } = JSON.parse(text.split('\n\n---\n')[0] ?? '{}') as {
    args: string[];
    cwd: string;
  };
  return { args, cwd, prompt: args[args.indexOf('--print') + 1] ?? '' };
}

/** Value that follows a flag in argv, e.g. flag(args, '--mode'). */
const flag = (args: string[], name: string) => args[args.indexOf(name) + 1];

afterEach(async () => {
  await client?.close();
  client = undefined;
});

describe('MCP server', () => {
  it('lists all tools', async () => {
    const c = await connect();
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'antigravity',
      'antigravity_analyze_media',
      'antigravity_brainstorm',
      'antigravity_models',
      'antigravity_ping',
      'antigravity_shell',
      'antigravity_web_search',
    ]);
  });

  it('lets agy edit files by default (accept-edits)', async () => {
    const c = await connect();
    const r = await call(c, 'antigravity', { prompt: 'hello' });
    expect(r.isError).toBe(false);
    const { args, prompt } = echoed(r.text);
    expect(prompt).toBe('hello');
    expect(flag(args, '--mode')).toBe('accept-edits');
    expect(args).not.toContain('--model');
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(r.text).toContain('conversationId: conv-123');
    expect(r.text).toContain('tokens: 42');
  });

  it('applies server defaults, and per-call arguments win over them', async () => {
    const c = await connect({ defaultModel: 'fake-flash', defaultEffort: 'low' });

    const defaults = echoed((await call(c, 'antigravity', { prompt: 'a' })).text).args;
    expect(flag(defaults, '--model')).toBe('fake-flash');
    expect(flag(defaults, '--effort')).toBe('low');

    const { args } = echoed(
      (
        await call(c, 'antigravity', {
          prompt: 'b',
          model: 'fake-pro',
          effort: 'max',
          mode: 'plan',
          conversationId: 'conv-9',
          timeoutSec: 7,
        })
      ).text,
    );
    expect(flag(args, '--model')).toBe('fake-pro');
    expect(flag(args, '--effort')).toBe('max');
    expect(flag(args, '--mode')).toBe('plan');
    expect(flag(args, '--conversation')).toBe('conv-9');
    expect(flag(args, '--print-timeout')).toBe('7s');
  });

  it('rejects an unknown mode before calling agy', async () => {
    const c = await connect();
    const r = await call(c, 'antigravity', { prompt: 'x', mode: 'yolo' });
    expect(r.isError).toBe(true);
  });

  it('returns agy errors as tool errors', async () => {
    const c = await connect();
    const r = await call(c, 'antigravity', { prompt: 'FAIL' });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('model boom is not recognized');
  });

  it('names the rule to add when agy is denied a permission', async () => {
    const c = await connect();
    const r = await call(c, 'antigravity', { prompt: 'DENIED' });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('permission-denied');
    expect(r.text).toContain('`read_url(<target>)`');
    expect(r.text).toContain('permissions.allow');
  });

  it('does not report an empty answer as success', async () => {
    const c = await connect();
    const r = await call(c, 'antigravity', { prompt: 'EMPTY' });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('without an answer');
  });

  it('passes agy warnings through in the footer', async () => {
    const c = await connect();
    const r = await call(c, 'antigravity', { prompt: 'WARN' });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('agy: warning: --mode auto is not available for this account');
  });

  it('reports non-JSON output', async () => {
    const c = await connect();
    const r = await call(c, 'antigravity', { prompt: 'GARBAGE' });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('bad-output');
  });

  it('marks partial answers after a print timeout', async () => {
    const c = await connect();
    const r = await call(c, 'antigravity', { prompt: 'PARTIAL' });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('half an answer');
    expect(r.text).toContain('response is partial');
  });

  it('lists models', async () => {
    const c = await connect({ defaultModel: 'fake-pro' });
    const r = await call(c, 'antigravity_models');
    expect(r.text).toContain('`fake-flash` — Fake Flash (Medium)');
    expect(r.text).toContain('Server default: `fake-pro`');
  });

  it('pings', async () => {
    const c = await connect();
    const r = await call(c, 'antigravity_ping', { message: 'hi' });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('pong: hi');
    expect(r.text).toContain('default mode: accept-edits');
  });

  it('explains a missing binary', async () => {
    const c = await connect({ bin: '/definitely/not/agy' });
    const r = await call(c, 'antigravity_ping');
    expect(r.isError).toBe(true);
    expect(r.text).toContain('not-found');
    expect(r.text).toContain('AGY_BIN');
  });

  it('stops agy when the client cancels', async () => {
    const c = await connect();
    const controller = new AbortController();
    const pending = c.callTool({ name: 'antigravity', arguments: { prompt: 'HANG' } }, undefined, {
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 300);
    await expect(pending).rejects.toThrow();
  });
});

describe('task tools', () => {
  let root: string;
  let shot: string;
  let pdf: string;

  beforeAll(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'agy-mcp-')));
    mkdirSync(join(root, 'a'));
    mkdirSync(join(root, 'b'));
    shot = join(root, 'a', 'shot.png');
    pdf = join(root, 'b', 'invoice.pdf');
    writeFileSync(shot, 'png');
    writeFileSync(pdf, 'pdf');
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('web search runs read-only with the query in the prompt', async () => {
    const c = await connect();
    const r = await call(c, 'antigravity_web_search', { query: 'latest Node.js LTS' });
    const { args, prompt } = echoed(r.text);
    expect(flag(args, '--mode')).toBe('plan');
    expect(prompt).toContain('latest Node.js LTS');
    expect(prompt).toMatch(/URLs/);
  });

  it('analyze-media runs in the files’ folders and lists their absolute paths', async () => {
    const c = await connect();
    const r = await call(c, 'antigravity_analyze_media', {
      filePaths: [shot, pdf],
      prompt: 'What is shown?',
    });
    expect(r.isError).toBe(false);
    const { args, cwd, prompt } = echoed(r.text);
    expect(flag(args, '--mode')).toBe('plan');
    expect(realpathSync(cwd)).toBe(join(root, 'a'));
    expect(flag(args, '--add-dir')).toBe(join(root, 'b'));
    expect(prompt).toContain(shot);
    expect(prompt).toContain(pdf);
    expect(prompt).toContain('What is shown?');
  });

  it('analyze-media rejects a missing file without calling agy', async () => {
    const c = await connect();
    const r = await call(c, 'antigravity_analyze_media', {
      filePaths: [join(root, 'nope.png')],
      prompt: 'x',
    });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('invalid-input');
    expect(r.text).toContain('nope.png');
  });

  it('shell only writes commands unless execute is true', async () => {
    const c = await connect();
    const dry = echoed((await call(c, 'antigravity_shell', { task: 'count lines in *.ts' })).text);
    expect(flag(dry.args, '--mode')).toBe('plan');
    expect(dry.prompt).toContain('Do not run anything');

    const run = echoed(
      (await call(c, 'antigravity_shell', { task: 'count lines', execute: true, cwd: root })).text,
    );
    expect(flag(run.args, '--mode')).toBe('accept-edits');
    expect(run.args).not.toContain('--dangerously-skip-permissions');
    expect(realpathSync(run.cwd)).toBe(root);
    expect(run.prompt).toContain('running shell commands');
  });

  it('brainstorm uses the chosen method and idea count', async () => {
    const c = await connect();
    const r = await call(c, 'antigravity_brainstorm', {
      topic: 'onboarding',
      method: 'scamper',
      ideas: 5,
      context: 'B2B app',
    });
    const { args, prompt } = echoed(r.text);
    expect(flag(args, '--mode')).toBe('plan');
    expect(prompt).toContain('onboarding');
    expect(prompt).toContain('SCAMPER');
    expect(prompt).toContain('Give 5 distinct ideas');
    expect(prompt).toContain('Context: B2B app');
  });

  it('brainstorm rejects an unknown method', async () => {
    const c = await connect();
    const r = await call(c, 'antigravity_brainstorm', { topic: 'x', method: 'magic' });
    expect(r.isError).toBe(true);
  });
});
