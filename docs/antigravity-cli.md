# Working with the Antigravity CLI

This server is a thin layer over `agy`. Anything `agy` can do in print mode, the server can do; anything that fails in `agy` will fail here too. When in doubt, run the same command in a terminal.

## Setup

1. Install the Antigravity CLI and check that it is on your `PATH`:

   ```bash
   agy --help
   ```

2. Sign in once by starting `agy` interactively and following the prompts. The server reuses that sign-in. It never handles your credentials.

3. Try print mode by hand:

   ```bash
   agy -p "say pong" --output-format json --mode plan
   ```

   You should get a JSON object with `"status":"SUCCESS"`.

## Quota

Calls go through your own Antigravity account, so they count against your Antigravity plan. They are separate from Gemini CLI, Gemini API keys, or any other tool's quota.

Every successful call reports `tokens:` in its footer, so you can see what a call costs.

## Models

```bash
agy models
```

prints `<id>\t<display name>` per line. Pass the id as `model`. To change what `agy` uses when no model is given, either set `AGY_DEFAULT_MODEL` for the server or change the model in Antigravity's own settings.

## Picking a working directory

`agy` sees the directory it runs in as its workspace. By default that is the directory your MCP client started the server from, which for Claude Code is usually the open project. Use `cwd` to point it somewhere else, and `addDirs` to give it more than one folder.

## Troubleshooting

**`not-found` error.** The server could not start `agy`. GUI apps such as Claude Desktop often start with a shorter `PATH` than your shell. Set `AGY_BIN` to the full path, which you can find with `which agy`.

**`failed: invalid model selection`.** The model id is wrong or not on your plan. Call `antigravity_models` for the list.

**The call takes a long time and the client gives up.** Some clients stop waiting before `agy` is done. Lower `timeoutSec` so `agy` returns a partial answer in time, or raise the client's own tool timeout (in Claude Code: the `MCP_TOOL_TIMEOUT` environment variable, in milliseconds).

**`permission-denied` error.** In print mode `agy` cannot ask you before running a command (`command`) or fetching a page (`read_url`), so it refuses. The error names the permission. Add a rule for it under `permissions.allow` in `agy`'s settings.json (usually `~/.gemini/antigravity-cli/settings.json`), as narrow as you can make it, then call the tool again. Check the Antigravity docs for the target patterns a rule accepts.

**`warning: --mode auto is not available for this account`.** Your plan does not offer `auto`, so `agy` falls back to its default mode. The warning shows up in the tool's footer. Use `accept-edits` instead, plus allow rules for the commands you want it to run.

**Nothing changed in my files.** Check the footer: `mode: plan` means the call was read-only. `antigravity` defaults to `accept-edits` unless `AGY_DEFAULT_MODE` says otherwise. The other tools, apart from `antigravity_shell` with `execute: true`, never edit files.

**Seeing what the server does.** Set `AGY_MCP_DEBUG=1`. The server then logs every `agy` command line to stderr, which most clients keep in their MCP logs.
