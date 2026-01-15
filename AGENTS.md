# OpenCode Breadcrumb Plugin

## Overview

This is an OpenCode plugin that displays timestamp, session duration, and git context on each user prompt. The breadcrumb appears at the top of each message.

## Architecture

**Single file plugin** - All logic is in `index.js`:
- Uses the `chat.message` hook to inject breadcrumb into user message parts
- Persists state (session start, last prompt time) to `~/.config/opencode/breadcrumb/`
- Executes git commands synchronously to gather repo context

## Key Limitations

### Context Token Cost

The breadcrumb text is injected into message parts, which means it becomes part of the conversation context sent to the LLM. Each breadcrumb costs ~30 tokens.

**Why not use `ignored: true`?**

We attempted to use the `ignored` flag on text parts to exclude from context while still displaying. Results:
- Without required IDs (id, sessionID, messageID): Validation error
- With proper IDs: Breadcrumb shows but user's message text disappears

OpenCode's `ignored` flag hides content from both UI and context. There's no "display-only" option. See `docs/FEATURE_REQUEST_STATUSLINE.md` for proposed solution.

### State Files

State persists in `~/.config/opencode/breadcrumb/`:
- `session_start_ts` - Resets on OpenCode restart
- `last_prompt_ts` - For calculating delta between prompts
- `last_interval_ts` - For 30-minute marker

## Output Format

```
🕐 MM-DD HH:MM (+Xm Xs) ⏱️XhXm * │ ⎇ branch ↑X↓X wt:name(N) │ ✎X +X │ "commit msg" Xh
```

| Component | Description |
|-----------|-------------|
| 🕐 | Date and time |
| (+...) | Delta since last prompt |
| ⏱️ | Session duration |
| * | 30-minute marker (every 30 min) |
| ⎇ | Git branch |
| ↑↓ | Ahead/behind upstream |
| wt: | Worktree info |
| ✎ | Modified files |
| + | Untracked files |
| "..." | Last commit message and age |

## Development

```bash
# Local testing - edit index.js directly
vim ~/.config/opencode/node_modules/opencode-breadcrumb/index.js

# Restart OpenCode to reload plugin
# Changes take effect on next prompt
```

## Publishing

```bash
npm version patch|minor|major
npm publish
git push
```

Requires npm token with 2FA bypass for automation.

## Related

- GitHub: https://github.com/keybrdist/opencode-breadcrumb
- npm: https://www.npmjs.com/package/opencode-breadcrumb
