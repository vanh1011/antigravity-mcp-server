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
      }),
    ).toEqual({
      bin: '/opt/agy',
      defaultModel: 'gemini-3.8-flash-high',
      defaultEffort: 'high',
      defaultMode: 'accept-edits',
      timeoutSec: 120,
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
    expect(permissionHint('a tool required the "read_url" permission that headless')).toContain(
      '`read_url(<target>)`',
    );
    expect(permissionHint('something else')).toContain('permissions.allow');
  });

  it('handles plain errors and other values', () => {
    expect(formatError(new Error('x'))).toBe('Unexpected error: x');
    expect(formatError('y')).toBe('Unexpected error: y');
  });
});
