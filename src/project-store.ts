import fs from "node:fs";
import path from "node:path";
import type { ProjectInfo } from "./types.js";
import { encodeProjectPath, getProjectsDir } from "./path-utils.js";
import { getSession, isAlive, listSessions } from "./session-store.js";
import { extractCwdFromJsonl } from "./jsonl-reader.js";

export function listProjects(claudeHome = "~/.claude"): ProjectInfo[] {
  const projectsDir = getProjectsDir(claudeHome);
  if (!fs.existsSync(projectsDir)) return [];

  const sessions = listSessions(claudeHome);
  const cwdToSessions = new Map<string, typeof sessions>();

  for (const s of sessions) {
    const list = cwdToSessions.get(s.cwd) || [];
    list.push(s);
    cwdToSessions.set(s.cwd, list);
  }

  const projects: ProjectInfo[] = [];
  for (const entry of fs.readdirSync(projectsDir).sort()) {
    const fullPath = path.join(projectsDir, entry);
    if (!fs.statSync(fullPath).isDirectory()) continue;

    // Resolve real path from session metadata (never decode directory name — lossy)
    const realPath = resolveProjectCwd(entry, fullPath, sessions);
    if (!realPath) continue;

    const jsonlFiles = fs.readdirSync(fullPath).filter((f) => f.endsWith(".jsonl"));
    const projectSessions = cwdToSessions.get(realPath) || [];

    projects.push({
      path: realPath,
      encoded_name: entry,
      session_count: jsonlFiles.length,
      has_active_session: projectSessions.some((s) => isAlive(s.pid)),
    });
  }

  return projects;
}

function resolveProjectCwd(
  encodedName: string,
  projectDir: string,
  sessions: { session_id: string; cwd: string }[],
): string | undefined {
  // Source 1: match encoded name against known session cwds
  for (const s of sessions) {
    if (encodeProjectPath(s.cwd) === encodedName) return s.cwd;
  }

  // Source 2: extract cwd from JSONL content (no lossy decode)
  const jsonlFiles = fs.readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));
  for (const jf of jsonlFiles) {
    const cwd = extractCwdFromJsonl(path.join(projectDir, jf));
    if (cwd) return cwd;
  }

  return undefined;
}

export function getProjectDir(projectPath: string, claudeHome = "~/.claude"): string | undefined {
  const encoded = encodeProjectPath(projectPath);
  const fullPath = path.join(getProjectsDir(claudeHome), encoded);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory() ? fullPath : undefined;
}
