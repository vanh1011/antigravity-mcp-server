import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import { ConfigError, AgyError, formatError, permissionHint } from '../errors.js';

describe('loadConfig', () => {
  it('uses the defaults', () => {
    expect(loadConfig({})).toEqual({
      bin: 'agy',
      defaultModel: undefined,
      defaultEffort: undefined,
      defaultMode: 'accept-edits',
      timeoutSec: 600,
      settingsPath: expect.stringMatching(/\.gemini\/antigravity-cli\/settings\.json$/),
    });
  });

  it('reads overrides from the environment', () => {
    expect(
      loadConfig({
        AGY_BIN: '/opt/agy',
        AGY_DEFAULT_MODEL: 'gemini-3.8-flash-high',
        AGY_DEFAULT_EFFORT: 'high',
        AGY_DEFAULT_MODE: 'accept-edits',
        AGY_TIMEOUT_SEC: '120',
        AGY_SETTINGS_PATH: '/tmp/agy-settings.json',
      }),
    ).toEqual({
      bin: '/opt/agy',
      defaultModel: 'gemini-3.8-flash-high',
      defaultEffort: 'high',
      defaultMode: 'accept-edits',
      timeoutSec: 120,
      settingsPath: '/tmp/agy-settings.json',
    });
  });

  it.each([
    ['AGY_DEFAULT_MODE', 'yolo'],
    ['AGY_DEFAULT_EFFORT', 'extreme'],
    ['AGY_TIMEOUT_SEC', 'abc'],
    ['AGY_TIMEOUT_SEC', '0'],
    ['AGY_TIMEOUT_SEC', '99999'],
  ])('rejects %s=%s', (key, value) => {
    expect(() => loadConfig({ [key]: value })).toThrow(ConfigError);
  });
});

describe('formatError', () => {
  it('adds a hint for known failures', () => {
    const text = formatError(new AgyError('not-found', 'Could not run "agy".'));
    expect(text).toContain('not-found');
    expect(text).toContain('AGY_BIN');
  });

  it('names the permission rule when agy says which one it needed', () => {
    const stderr = 'a tool required the "command" permission that headless';
    const none = permissionHint(stderr);
    expect(none).toContain('`command(git diff)`');
    expect(none).toContain('No command rules are allowed yet.');
    expect(none).toContain('stops at the first denied action');

    const some = permissionHint(stderr, ['command(git status)', 'read_url(github.com)']);
    expect(some).toContain('Currently allowed command rules: command(git status)');
    expect(some).not.toContain('github.com');
    expect(permissionHint('something else')).toContain('permissions.allow');
  });

  it('handles plain errors and other values', () => {
    expect(formatError(new Error('x'))).toBe('Unexpected error: x');
    expect(formatError('y')).toBe('Unexpected error: y');
  });
});
