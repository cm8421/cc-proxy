import fs from "node:fs";
import path from "node:path";
import type { SessionEntry } from "./types.js";
import { getSessionsDir } from "./path-utils.js";

export function listSessions(claudeHome = "~/.claude"): SessionEntry[] {
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

export function getSession(sessionId: string, claudeHome = "~/.claude"): SessionEntry | undefined {
  return listSessions(claudeHome).find((s) => s.session_id === sessionId);
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
