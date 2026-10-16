import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AgyError } from '../errors.js';
import { buildAskArgs, parseAskOutput, parseModels, runProcess } from '../utils/agyExecutor.js';

describe('buildAskArgs', () => {
  it('always sends print mode, JSON output, mode and timeout', () => {
    expect(buildAskArgs({ prompt: 'hi', mode: 'plan', timeoutSec: 30 })).toEqual([
      '--print',
      'hi',
      '--output-format',
      'json',
      '--mode',
      'plan',
      '--print-timeout',
      '30s',
    ]);
  });

  it('adds optional flags only when set', () => {
    const args = buildAskArgs({
      prompt: 'hi',
      mode: 'auto',
      timeoutSec: 10,
      model: 'm',
      effort: 'high',
      conversationId: 'c1',
      project: 'p1',
      sandbox: true,
      addDirs: ['/a', '/b'],
    });
    expect(args.slice(8)).toEqual([
      '--model',
      'm',
      '--effort',
      'high',
      '--conversation',
      'c1',
      '--project',
      'p1',
      '--sandbox',
      '--add-dir',
      '/a',
      '--add-dir',
      '/b',
    ]);
  });

  it('keeps a prompt that looks like a flag as the value of --print', () => {
    const args = buildAskArgs({ prompt: '--help', mode: 'plan', timeoutSec: 5 });
    expect(args.slice(0, 2)).toEqual(['--print', '--help']);
  });
});

describe('parseAskOutput', () => {
  const ok = JSON.stringify({
    conversation_id: 'c1',
    status: 'SUCCESS',
    response: 'pong\n',
    duration_seconds: 2,
    num_turns: 1,
    usage: { total_tokens: 10 },
  });

  it('reads a successful result', () => {
    expect(parseAskOutput({ code: 0, stdout: ok, stderr: '' }, 60)).toEqual({
      response: 'pong\n',
      conversationId: 'c1',
      durationSeconds: 2,
      numTurns: 1,
      totalTokens: 10,
      partial: false,
      notes: [],
    });
  });

  it('keeps stderr warnings as notes', () => {
    const r = parseAskOutput({ code: 0, stdout: ok, stderr: 'warning: a\n\nwarning: a\n' }, 60);
    expect(r.notes).toEqual(['warning: a']);
  });

  const empty = JSON.stringify({ conversation_id: 'c1', status: 'SUCCESS', response: '' });

  it('treats an empty answer after a denied permission as permission-denied', () => {
    const stderr =
      'jetski: no output produced — a tool required the "command" permission that headless mode cannot prompt for, so it was auto-denied.';
    expect(() => parseAskOutput({ code: 0, stdout: empty, stderr }, 60)).toThrowError(
      expect.objectContaining({
        kind: 'permission-denied',
        hint: expect.stringContaining('`command(<target>)`'),
      }),
    );
  });

  it('treats an empty answer after a print timeout as a timeout', () => {
    expect(() =>
      parseAskOutput({ code: 0, stdout: empty, stderr: '[agy] print timeout after 5s' }, 5),
    ).toThrowError(expect.objectContaining({ kind: 'timeout' }));
  });

  it('treats any other empty answer as failed', () => {
    expect(() => parseAskOutput({ code: 0, stdout: empty, stderr: '' }, 5)).toThrowError(
      expect.objectContaining({ kind: 'failed' }),
    );
  });

  it('skips non-JSON lines printed before the result', () => {
    const r = parseAskOutput({ code: 0, stdout: `warning: x\n${ok}\n`, stderr: '' }, 60);
    expect(r.response).toBe('pong\n');
  });

  it('flags partial output after a print timeout', () => {
    const r = parseAskOutput(
      { code: 0, stdout: ok, stderr: '[agy] print timeout after 2s with turn in progress' },
      60,
    );
    expect(r.partial).toBe(true);
  });

  it('throws "failed" with agy\'s own message on an ERROR status', () => {
    const stdout = JSON.stringify({ status: 'ERROR', error: 'model x is not recognized' });
    try {
      parseAskOutput({ code: 1, stdout, stderr: '' }, 60);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AgyError);
      expect((e as AgyError).kind).toBe('failed');
      expect((e as AgyError).message).toContain('model x is not recognized');
    }
  });

  it('throws "bad-output" when there is no JSON', () => {
    expect(() => parseAskOutput({ code: 2, stdout: 'nope', stderr: 'boom' }, 60)).toThrowError(
      expect.objectContaining({ kind: 'bad-output' }),
    );
  });

  it('reports timeouts and cancellations by how the process was stopped', () => {
    expect(() =>
      parseAskOutput({ code: null, stdout: '', stderr: '', stoppedBy: 'timeout' }, 5),
    ).toThrowError(expect.objectContaining({ kind: 'timeout' }));
    expect(() =>
      parseAskOutput({ code: null, stdout: '', stderr: '', stoppedBy: 'cancel' }, 5),
    ).toThrowError(expect.objectContaining({ kind: 'cancelled' }));
  });
});

describe('runProcess', () => {
  const fakeAgy = fileURLToPath(new URL('./fixtures/fake-agy.mjs', import.meta.url));
  const hang = ['--print', 'HANG'];

  it('kills agy when the signal aborts', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 200);
    const started = Date.now();
    const r = await runProcess(fakeAgy, hang, { hardTimeoutMs: 30_000, signal: controller.signal });
    expect(r.stoppedBy).toBe('cancel');
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('kills agy after the hard timeout', async () => {
    const r = await runProcess(fakeAgy, hang, { hardTimeoutMs: 300 });
    expect(r.stoppedBy).toBe('timeout');
  });

  it('rejects with not-found for a missing binary', async () => {
    await expect(
      runProcess('/definitely/not/agy', [], { hardTimeoutMs: 1_000 }),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });
});

describe('parseModels', () => {
  it('splits id and display name on the tab', () => {
    expect(parseModels('a-high\tModel A (High)\n\nb\tModel B\n')).toEqual([
      { id: 'a-high', name: 'Model A (High)' },
      { id: 'b', name: 'Model B' },
    ]);
  });

  it('falls back to the id when there is no display name', () => {
    expect(parseModels('only-id')).toEqual([{ id: 'only-id', name: 'only-id' }]);
  });
});
