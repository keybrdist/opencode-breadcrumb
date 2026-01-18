# opencode-breadcrumb

OpenCode plugin that displays timestamp, session duration, and git context on each prompt.

## Prerequisites

- [OpenCode](https://opencode.ai) CLI
- Node.js >= 18
- Git (for git context features)

## Example Output

```
🕐 01-14 18:30 (+2m15s) ⏱️1h23m * │ ⎇ main ↑2↓1 wt:feature(2) │ ✎3 +5 │ "Last commit msg" 2h
```

![OpenCode Breadcrumb Plugin in Action](https://github.com/user-attachments/assets/65eae4f5-b86c-45cf-b3ea-424a1e3ebd1e)

## Format Reference

### Time Section

| Symbol | Example | Description |
|--------|---------|-------------|
| 🕐 | `🕐 01-14 18:30` | Current date (MM-DD) and time (HH:MM) |
| (+...) | `(+2m15s)` | Time elapsed since last prompt |
| ⏱️ | `⏱️1h23m` | Total session duration |
| * | `*` | 30-minute checkpoint marker (appears every 30 min) |

### Git Section

| Symbol | Example | Description |
|--------|---------|-------------|
| ⎇ | `⎇ main` | Current git branch |
| ↑ | `↑2` | Commits ahead of upstream |
| ↓ | `↓1` | Commits behind upstream |
| wt: | `wt:feature(2)` | Worktree name and total worktree count |
| ✎ | `✎3` | Number of modified files |
| + | `+5` | Number of untracked files |
| "..." | `"Last commit msg" 2h` | Last commit message (truncated) and age |

### Separators

| Symbol | Description |
|--------|-------------|
| │ | Separates major sections |
| ⊘ | Shown when not in a git repository |

## First Prompt Defaults

On the first prompt of a session:
- Delta shows `(+0s)`
- Session shows `⏱️0s`
- The `*` marker is skipped

## Installation

```bash
npm install opencode-breadcrumb
```

Add to your `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-breadcrumb"]
}
```

Then restart OpenCode.

## Local Development

Clone the repo and link it locally:

```bash
git clone https://github.com/keybrdist/opencode-breadcrumb.git
cd opencode-breadcrumb
npm link
```

Then in your OpenCode config directory:

```bash
cd ~/.config/opencode/node_modules
npm link opencode-breadcrumb
```

Or copy directly to node_modules:

```bash
cp -r opencode-breadcrumb ~/.config/opencode/node_modules/
```

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-breadcrumb"]
}
```

Restart OpenCode to load the plugin.

## State Files

State is stored in `~/.config/opencode/breadcrumb/`:

| File | Purpose |
|------|---------|
| `last_prompt_ts` | Timestamp of last prompt (for delta calculation) |
| `last_interval_ts` | Timestamp of last 30-min marker |
| `session_start_ts` | Session start time |

To reset session tracking:

```bash
rm -rf ~/.config/opencode/breadcrumb/
```

## Troubleshooting

**Plugin not loading?**
- Ensure `opencode-breadcrumb` is listed in the `plugin` array in `opencode.json`
- Restart OpenCode after config changes

**Git info not showing?**
- Make sure you're in a git repository
- Shows `⊘ no git` when not in a repo

**Session timer keeps resetting?**
- Session state persists across prompts but resets when OpenCode restarts
- State files are in `~/.config/opencode/breadcrumb/`

## License

MIT
