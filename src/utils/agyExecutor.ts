import { spawn } from 'node:child_process';
import { DEFAULTS } from '../constants.js';
import { AgyError, permissionHint } from '../errors.js';
import type { AgyJsonOutput, AskOptions, AskResult, ModelInfo, ServerConfig } from '../types.js';
import { logger } from './logger.js';

export interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
  /** Set when we had to stop the process ourselves. */
  stoppedBy?: 'timeout' | 'cancel';
}

interface RunOptions {
  cwd?: string;
  hardTimeoutMs: number;
  signal?: AbortSignal;
}

/** Spawn agy and collect its output. Rejects only when the binary cannot start. */
export function runProcess(bin: string, args: string[], opts: RunOptions): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    logger.debug(
      'spawn',
      bin,
      args.map((a) => (a.length > 80 ? `${a.slice(0, 80)}…` : a)),
    );
    const child = spawn(bin, args, { cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let stoppedBy: ProcessResult['stoppedBy'];

    const stop = (reason: 'timeout' | 'cancel') => {
      if (stoppedBy || child.exitCode !== null) return;
      stoppedBy = reason;
      child.kill('SIGTERM');
      setTimeout(() => child.exitCode === null && child.kill('SIGKILL'), 5_000).unref();
    };

    const timer = setTimeout(() => stop('timeout'), opts.hardTimeoutMs);
    const onAbort = () => stop('cancel');
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    const cleanup = () => {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    };

    child.stdout.on('data', (d: Buffer) => (stdout += d));
    child.stderr.on('data', (d: Buffer) => (stderr += d));
    child.on('error', (err: NodeJS.ErrnoException) => {
      cleanup();
      if (err.code === 'ENOENT') {
        reject(new AgyError('not-found', `Could not run "${bin}": command not found.`));
      } else {
        reject(new AgyError('failed', `Could not run "${bin}": ${err.message}`));
      }
    });
    child.on('close', (code) => {
      cleanup();
      resolve({ code, stdout, stderr, stoppedBy });
    });
  });
}

/** Build the argv for a print-mode call. */
export function buildAskArgs(o: AskOptions): string[] {
  const args = [
    '--print',
    o.prompt,
    '--output-format',
    'json',
    '--mode',
    o.mode,
    '--print-timeout',
    `${o.timeoutSec}s`,
  ];
  if (o.model) args.push('--model', o.model);
  if (o.effort) args.push('--effort', o.effort);
  if (o.conversationId) args.push('--conversation', o.conversationId);
  if (o.project) args.push('--project', o.project);
  if (o.sandbox) args.push('--sandbox');
  for (const dir of o.addDirs ?? []) args.push('--add-dir', dir);
  return args;
}

/** Non-empty stderr lines, e.g. "warning: --mode auto is not available for this account". */
function stderrNotes(stderr: string): string[] {
  const lines = stderr
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return [...new Set(lines)].slice(0, 10);
}

/** agy may print warnings before the JSON object, so take the last line that parses. */
function extractJson(stdout: string): AgyJsonOutput | undefined {
  const lines = stdout.split('\n').map((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line?.startsWith('{')) continue;
    try {
      return JSON.parse(line) as AgyJsonOutput;
    } catch {
      // keep looking
    }
  }
  return undefined;
}

/** Interpret the output of a print-mode call. Throws AgyError on failure. */
export function parseAskOutput(r: ProcessResult, timeoutSec: number): AskResult {
  if (r.stoppedBy === 'cancel') throw new AgyError('cancelled', 'Request cancelled.');
  if (r.stoppedBy === 'timeout') {
    throw new AgyError('timeout', `agy did not finish within ${timeoutSec}s.`, r.stderr);
  }

  const json = extractJson(r.stdout);
  if (!json) {
    throw new AgyError(
      'bad-output',
      `agy exited with code ${r.code} and no JSON result.`,
      [r.stdout, r.stderr].filter(Boolean).join('\n'),
    );
  }
  if (json.status !== 'SUCCESS') {
    throw new AgyError('failed', json.error || `agy returned status ${json.status ?? 'unknown'}.`);
  }

  const response = json.response ?? '';
  const partial = /print timeout/i.test(r.stderr);

  // agy reports SUCCESS with an empty answer when it gave up, and says why on stderr.
  if (!response.trim()) {
    if (/auto-denied|cannot prompt/i.test(r.stderr)) {
      throw new AgyError(
        'permission-denied',
        'agy needed a permission that print mode cannot ask for, so it stopped.',
        r.stderr,
        permissionHint(r.stderr),
      );
    }
    if (partial) {
      throw new AgyError('timeout', `agy produced nothing within ${timeoutSec}s.`, r.stderr);
    }
    throw new AgyError('failed', 'agy finished without an answer.', r.stderr);
  }

  return {
    response,
    conversationId: json.conversation_id ?? '',
    durationSeconds: json.duration_seconds,
    numTurns: json.num_turns,
    totalTokens: json.usage?.total_tokens,
    partial,
    notes: stderrNotes(r.stderr),
  };
}

export async function ask(
  config: ServerConfig,
  o: AskOptions,
  signal?: AbortSignal,
): Promise<AskResult> {
  const r = await runProcess(config.bin, buildAskArgs(o), {
    cwd: o.cwd,
    hardTimeoutMs: o.timeoutSec * 1000 + DEFAULTS.KILL_GRACE_MS,
    signal,
  });
  return parseAskOutput(r, o.timeoutSec);
}

/** Parse `agy models`, which prints one "<id>\t<display name>" per line. */
export function parseModels(stdout: string): ModelInfo[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id = '', ...rest] = line.split('\t');
      return { id: id.trim(), name: rest.join(' ').trim() || id.trim() };
    });
}

export async function listModels(config: ServerConfig, signal?: AbortSignal): Promise<ModelInfo[]> {
  const r = await runProcess(config.bin, ['models'], { hardTimeoutMs: 60_000, signal });
  if (r.code !== 0) {
    throw new AgyError('failed', `agy models exited with code ${r.code}.`, r.stderr || r.stdout);
  }
  return parseModels(r.stdout);
}

/** Confirm the binary starts. Returns the first line of its help text. */
export async function checkBinary(config: ServerConfig): Promise<string> {
  const r = await runProcess(config.bin, ['--help'], { hardTimeoutMs: 30_000 });
  const out = `${r.stdout}${r.stderr}`;
  if (r.code !== 0 && !/usage/i.test(out)) {
    throw new AgyError('failed', `"${config.bin} --help" exited with code ${r.code}.`, out);
  }
  return out.split('\n').find(Boolean)?.trim() ?? '';
}
