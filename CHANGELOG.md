# Changelog

## 0.1.1 — 2026-10-16

- `permission-denied` errors now give a concrete example rule, list the rules already allowed in `agy`'s settings.json, and explain that `agy` stops at the first denied action.
- New `AGY_SETTINGS_PATH` to point at a non-default `agy` settings file.
- README: how to write `permissions.allow` rules.

## 0.1.0 — 2026-10-16

First public release.

- `antigravity` tool: hands a task to `agy` in print mode, with model, effort, mode, conversation, project, workspace and timeout options. Runs in `accept-edits` mode by default.
- `antigravity_web_search`, `antigravity_analyze_media`, `antigravity_shell` and `antigravity_brainstorm` tools.
- `antigravity_models` and `antigravity_ping` tools.
- Clear `permission-denied` errors that name the `agy` allow rule to add. The server never disables `agy`'s permission checks.
- Empty answers are reported as errors instead of success, and `agy` warnings are shown in the result.
- Progress notifications during long calls, and the `agy` process is stopped when the client cancels.
- Configuration through `AGY_*` environment variables.
