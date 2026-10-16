import type { EFFORTS, MODES } from './constants.js';

export type Mode = (typeof MODES)[number];
export type Effort = (typeof EFFORTS)[number];

export interface ServerConfig {
  bin: string;
  defaultModel?: string;
  defaultEffort?: Effort;
  defaultMode: Mode;
  timeoutSec: number;
  /** agy's settings.json, read to list allowed rules in permission errors. */
  settingsPath: string;
}

export interface AskOptions {
  prompt: string;
  model?: string;
  effort?: Effort;
  mode: Mode;
  conversationId?: string;
  project?: string;
  addDirs?: string[];
  sandbox?: boolean;
  timeoutSec: number;
  cwd?: string;
}

export interface AskResult {
  response: string;
  conversationId: string;
  durationSeconds?: number;
  numTurns?: number;
  totalTokens?: number;
  /** True when agy hit --print-timeout and returned whatever it had. */
  partial: boolean;
  /** Warnings agy printed on stderr. */
  notes: string[];
}

export interface ModelInfo {
  id: string;
  name: string;
}

/** Shape of `agy -p ... --output-format json`. */
export interface AgyJsonOutput {
  conversation_id?: string;
  status?: string;
  response?: string;
  error?: string;
  duration_seconds?: number;
  num_turns?: number;
  usage?: { total_tokens?: number };
}
