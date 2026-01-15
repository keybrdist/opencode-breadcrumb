import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

const STATE_DIR = path.join(process.env.HOME || process.cwd(), ".config", "opencode", "breadcrumb");
const LAST_PROMPT_FILE = path.join(STATE_DIR, "last_prompt_ts");
const LAST_INTERVAL_FILE = path.join(STATE_DIR, "last_interval_ts");
const SESSION_START_FILE = path.join(STATE_DIR, "session_start_ts");
const INTERVAL_SECONDS = 1800; // 30 minutes

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTimeShort(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateShort(date) {
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDurationCompact(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}h${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m${secs}s`;
  } else {
    return `${secs}s`;
  }
}

async function readNumber(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const num = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(num) ? num : null;
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeNumber(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, String(value), "utf8");
}

function git(cmd, cwd) {
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function getGitContext(cwd) {
  const root = git("rev-parse --show-toplevel", cwd);
  if (!root) return "⊘ no git";

  const branch = git("rev-parse --abbrev-ref HEAD", cwd) || "?";

  // Worktree info
  let worktreeInfo = "";
  const worktreeList = git("worktree list --porcelain", cwd);
  if (worktreeList) {
    const worktrees = worktreeList.split("\n\n").filter(Boolean);
    const wtCount = worktrees.length;
    
    const currentWt = git("rev-parse --show-toplevel", cwd);
    if (currentWt) {
      const wtName = path.basename(currentWt);
      const gitDir = git("rev-parse --git-dir", cwd);
      const isWorktree = gitDir && gitDir.includes(".git/worktrees");
      if (isWorktree || wtCount > 1) {
        worktreeInfo = ` wt:${wtName}${wtCount > 1 ? `(${wtCount})` : ""}`;
      }
    }
  }

  // Upstream ahead/behind
  let upstream = "";
  const upstreamRef = git("rev-parse --abbrev-ref @{u}", cwd);
  if (upstreamRef) {
    const ahead = git("rev-list --count @{u}..HEAD", cwd) || "0";
    const behind = git("rev-list --count HEAD..@{u}", cwd) || "0";
    if (ahead !== "0" || behind !== "0") {
      upstream = ` ↑${ahead}↓${behind}`;
    }
  }

  // Dirty files: modified and untracked
  const status = git("status --porcelain", cwd) || "";
  const lines = status.split("\n").filter(Boolean);
  const modified = lines.filter((l) => l[0] === "M" || l[1] === "M").length;
  const untracked = lines.filter((l) => l.startsWith("??")).length;
  let dirty = "";
  if (modified > 0 || untracked > 0) {
    const parts = [];
    if (modified > 0) parts.push(`✎${modified}`);
    if (untracked > 0) parts.push(`+${untracked}`);
    dirty = parts.join(" ");
  }

  // Last commit: subject and relative time (compact)
  const lastCommit = git('log -1 --format="%s|%ar"', cwd);
  let commitInfo = "";
  if (lastCommit) {
    const [subject, age] = lastCommit.split("|");
    const shortSubject = subject.length > 18 ? subject.slice(0, 15) + "..." : subject;
    const compactAge = age.replace(/ seconds? ago/, "s").replace(/ minutes? ago/, "m").replace(/ hours? ago/, "h").replace(/ days? ago/, "d");
    commitInfo = `"${shortSubject}" ${compactAge}`;
  }

  // Build compact git info
  const infoParts = [`⎇ ${branch}${upstream}${worktreeInfo}`];
  if (dirty) infoParts.push(dirty);
  if (commitInfo) infoParts.push(commitInfo);

  return infoParts.join(" │ ");
}

async function buildTimestamp(nowMs) {
  const nowSeconds = Math.floor(nowMs / 1000);
  const date = new Date(nowMs);
  const timeStr = formatTimeShort(date);
  const dateStr = formatDateShort(date);

  // Session duration
  let sessionStart = await readNumber(SESSION_START_FILE);
  if (sessionStart === null) {
    sessionStart = nowSeconds;
    await writeNumber(SESSION_START_FILE, sessionStart);
  }
  const sessionDuration = Math.max(0, nowSeconds - sessionStart);
  const sessionInfo = formatDurationCompact(sessionDuration);

  // Delta since last prompt
  const lastPromptSeconds = await readNumber(LAST_PROMPT_FILE);
  const isFirstPrompt = lastPromptSeconds === null;
  let deltaMessage = "+0s";
  if (!isFirstPrompt) {
    const diff = Math.max(0, nowSeconds - lastPromptSeconds);
    deltaMessage = `+${formatDurationCompact(diff)}`;
  }

  // 30-minute interval marker (skip on first prompt)
  const lastIntervalSeconds = await readNumber(LAST_INTERVAL_FILE);
  const shouldEmitInterval = !isFirstPrompt && 
    (typeof lastIntervalSeconds !== "number" || nowSeconds - lastIntervalSeconds >= INTERVAL_SECONDS);
  const intervalMarker = shouldEmitInterval ? " *" : "";

  await writeNumber(LAST_PROMPT_FILE, nowSeconds);
  if (shouldEmitInterval) {
    await writeNumber(LAST_INTERVAL_FILE, nowSeconds);
  }

  return `🕐 ${dateStr} ${timeStr} (${deltaMessage}) ⏱️${sessionInfo}${intervalMarker}`;
}

const TimestampPlugin = async (ctx) => {
  return {
    "chat.message": async (_input, output) => {
      try {
        const nowMs = Date.now();
        const cwd = ctx.directory || process.cwd();
        const timestamp = await buildTimestamp(nowMs);
        const gitContext = getGitContext(cwd);
        const line = `${timestamp} │ ${gitContext}`;
        
        if (!output.parts) output.parts = [];
        output.parts.unshift({ type: "text", text: line, ignored: true });
      } catch (error) {
        console.error("timestamp-plugin error:", error);
      }
    },
  };
};

export default TimestampPlugin;
