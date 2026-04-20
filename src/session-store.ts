import fs from "node:fs";
import path from "node:path";
import type { SessionEntry } from "./types.js";
import { getSessionsDir, getProjectsDir } from "./path-utils.js";
import { extractCwdFromJsonl } from "./jsonl-reader.js";

function listActiveSessions(claudeHome = "~/.claude"): SessionEntry[] {
  const dir = getSessionsDir(claudeHome);
  if (!fs.existsSync(dir)) return [];

  const entries: SessionEntry[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
      entries.push({
        pid: data.pid,
        session_id: data.sessionId,
        cwd: data.cwd,
        started_at: data.startedAt,
        kind: data.kind ?? "interactive",
        entrypoint: data.entrypoint ?? "cli",
      });
    } catch {
      continue;
    }
  }

  entries.sort((a, b) => b.started_at - a.started_at);
  return entries;
}

const MAX_INACTIVE_SESSIONS = 200;

function listInactiveSessions(activeIds: Set<string>, claudeHome = "~/.claude"): SessionEntry[] {
  const projectsDir = getProjectsDir(claudeHome);
  if (!fs.existsSync(projectsDir)) return [];

  const entries: SessionEntry[] = [];
  for (const dirEntry of fs.readdirSync(projectsDir)) {
    if (entries.length >= MAX_INACTIVE_SESSIONS) break;
    const projectDir = path.join(projectsDir, dirEntry);
    if (!fs.statSync(projectDir).isDirectory()) continue;

    const jsonlFiles = fs.readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
      .reverse();

    for (const jf of jsonlFiles) {
      if (entries.length >= MAX_INACTIVE_SESSIONS) break;
      const sessionId = jf.replace(/\.jsonl$/, "");
      if (activeIds.has(sessionId)) continue;

      const jsonlPath = path.join(projectDir, jf);
      const cwd = extractCwdFromJsonl(jsonlPath);
      if (!cwd) continue;

      let startedAt: number;
      try {
        startedAt = Math.round(fs.statSync(jsonlPath).mtimeMs);
      } catch {
        startedAt = 0;
      }

      entries.push({
        pid: 0,
        session_id: sessionId,
        cwd,
        started_at: startedAt,
        kind: "interactive",
        entrypoint: "cli",
      });
    }
  }

  entries.sort((a, b) => b.started_at - a.started_at);
  return entries;
}

export function listSessions(claudeHome = "~/.claude"): SessionEntry[] {
  const active = listActiveSessions(claudeHome);
  const activeIds = new Set(active.map((s) => s.session_id));
  const inactive = listInactiveSessions(activeIds, claudeHome);
  return [...active, ...inactive].sort((a, b) => b.started_at - a.started_at);
}

export function getSession(sessionId: string, claudeHome = "~/.claude"): SessionEntry | undefined {
  const active = listActiveSessions(claudeHome);
  const found = active.find((s) => s.session_id === sessionId);
  if (found) return found;

  const activeIds = new Set(active.map((s) => s.session_id));
  return listInactiveSessions(activeIds, claudeHome).find((s) => s.session_id === sessionId);
}

export function isAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
