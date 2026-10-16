# API reference

The server exposes seven tools over MCP (stdio transport). Every tool except `antigravity_models` and `antigravity_ping` makes one `agy --print` call and returns the answer in the [result format](#result-format) below.

## `antigravity`

Hands one task or question to `agy` and returns the answer.

| Parameter        | Type                                            | Default                             | Notes                                                                                 |
| ---------------- | ----------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| `prompt`         | string                                          | required                            | The task or question.                                                                 |
| `model`          | string                                          | `AGY_DEFAULT_MODEL`                 | A model id from `antigravity_models`, e.g. `gemini-3.8-flash-high`.                   |
| `effort`         | `low` \| `medium` \| `high` \| `xhigh` \| `max` | `AGY_DEFAULT_EFFORT`                | Reasoning effort.                                                                     |
| `mode`           | `plan` \| `accept-edits` \| `auto`              | `AGY_DEFAULT_MODE` (`accept-edits`) | See [Modes and permissions](#modes-and-permissions).                                  |
| `conversationId` | string                                          | —                                   | Continue an earlier conversation. Every successful call returns its id.               |
| `project`        | string                                          | —                                   | Antigravity project id or name (`agy --project`).                                     |
| `cwd`            | string                                          | server's working dir                | Directory `agy` runs in. This is the workspace it can see and edit.                   |
| `addDirs`        | string[]                                        | —                                   | Extra directories added to the workspace (`--add-dir`).                               |
| `sandbox`        | boolean                                         | `false`                             | Run with terminal restrictions (`--sandbox`).                                         |
| `timeoutSec`     | integer, 1–3600                                 | `AGY_TIMEOUT_SEC` (600)             | Passed to `--print-timeout`. If it fires, whatever `agy` produced so far is returned. |

## `antigravity_web_search`

Looks something up on the web and answers with the source URLs. Runs in `plan` mode.

| Parameter    | Type    | Notes                      |
| ------------ | ------- | -------------------------- |
| `query`      | string  | Required. What to look up. |
| `model`      | string  | Optional.                  |
| `timeoutSec` | integer | Optional.                  |

Needs the `read_url` permission. See [Modes and permissions](#modes-and-permissions).

## `antigravity_analyze_media`

Reads images, screenshots or PDFs and answers a question about them. Runs in `plan` mode.

| Parameter    | Type     | Notes                                                                |
| ------------ | -------- | -------------------------------------------------------------------- |
| `filePaths`  | string[] | Required. Relative paths are resolved from the server's working dir. |
| `prompt`     | string   | Required. What to find out.                                          |
| `model`      | string   | Optional.                                                            |
| `timeoutSec` | integer  | Optional.                                                            |

`agy` runs in the folder of the first file, and the folders of the others are added with `--add-dir`. A missing file is reported as `invalid-input` before `agy` is called.

## `antigravity_shell`

Writes the shell commands for a task, or runs them.

| Parameter    | Type    | Notes                                                                                                 |
| ------------ | ------- | ----------------------------------------------------------------------------------------------------- |
| `task`       | string  | Required. What the commands should do.                                                                |
| `execute`    | boolean | `false` (default): write the commands only, in `plan` mode. `true`: run them, in `accept-edits` mode. |
| `cwd`        | string  | Optional. Directory to work in.                                                                       |
| `model`      | string  | Optional.                                                                                             |
| `timeoutSec` | integer | Optional.                                                                                             |

With `execute: true`, `agy` needs the `command` permission for the commands it runs.

## `antigravity_brainstorm`

Generates ideas on a topic and picks the most promising. Runs in `plan` mode.

| Parameter    | Type    | Notes                                                                                      |
| ------------ | ------- | ------------------------------------------------------------------------------------------ |
| `topic`      | string  | Required.                                                                                  |
| `method`     | string  | `open` (default), `scamper`, `design-thinking`, `first-principles`, `six-hats`, `reverse`. |
| `ideas`      | integer | 3–30, default 8.                                                                           |
| `context`    | string  | Optional background: constraints, audience, what has been tried.                           |
| `model`      | string  | Optional.                                                                                  |
| `timeoutSec` | integer | Optional.                                                                                  |

## `antigravity_models`

No parameters. Runs `agy models` and returns one line per model:

```
- `gemini-3.8-flash-high` — Gemini 3.8 Flash (High)
- `claude-opus-4-6-thinking` — Claude Opus 4.6 (Thinking)
```

The list depends on your Antigravity plan.

## `antigravity_ping`

| Parameter | Type   | Notes                  |
| --------- | ------ | ---------------------- |
| `message` | string | Optional, echoed back. |

Checks that `agy` starts (`agy --help`) and prints the server's effective settings. It does not call a model, so it uses no quota.

## Result format

The answer text, followed by a footer:

```
---
conversationId: 87d0d2ce-3cec-4504-80d4-eb879ccb81bf
model: gemini-3.8-flash-high
mode: accept-edits
duration: 13.9s
tokens: 16372
```

- `model: agy default` means no model was passed, so `agy` used the one set in its own settings.
- If the run was cut short by the timeout, the footer has `note: timed out, response is partial`.
- Warnings `agy` printed, such as `warning: --mode auto is not available for this account`, appear as `agy: ...` lines.

## Modes and permissions

| Mode           | What `agy` may do                                                     |
| -------------- | --------------------------------------------------------------------- |
| `plan`         | Read files and answer. No edits.                                      |
| `accept-edits` | Edit files in the workspace.                                          |
| `auto`         | Also run commands without asking. Not every account offers this mode. |

Separately from the mode, some actions need a permission: running shell commands (`command`) and fetching web pages (`read_url`). Print mode cannot ask you, so `agy` refuses them unless a rule in `permissions.allow` of its settings.json already allows them. The tool then fails with `permission-denied` and names the rule to add.

The server never passes `--dangerously-skip-permissions`. What `agy` may do is decided by your own `agy` settings.

## Errors

Failures come back as a tool result with `isError: true` and a message of the form `Antigravity error (<kind>): ...` plus a hint.

| Kind                | Meaning                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| `not-found`         | The `agy` binary could not be started. Check `PATH` or `AGY_BIN`.                    |
| `failed`            | `agy` reported an error (e.g. an unknown model) or finished without an answer.       |
| `permission-denied` | `agy` needed a permission that print mode cannot ask for. The hint names the rule.   |
| `timeout`           | `agy` produced nothing in time, or did not exit after `--print-timeout` plus 30 s.   |
| `cancelled`         | The client cancelled the request. The `agy` process is stopped.                      |
| `bad-output`        | `agy` printed no JSON result. Its raw output is included.                            |
| `invalid-input`     | An argument was wrong, e.g. a file passed to `antigravity_analyze_media` is missing. |

## Progress

If the client sends a `progressToken`, the server sends a progress notification every 20 seconds while `agy` runs. Clients that reset their timeout on progress will keep waiting for long tasks.
