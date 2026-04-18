import fs from "node:fs";
import path from "node:path";
import type { ProjectInfo } from "./types.js";
import { decodeProjectDir, encodeProjectPath, getProjectsDir } from "./path-utils.js";
import { isAlive, listSessions } from "./session-store.js";

export function listProjects(claudeHome = "~/.claude"): ProjectInfo[] {
  const projectsDir = getProjectsDir(claudeHome);
  if (!fs.existsSync(projectsDir)) return [];

  const sessions = listSessions(claudeHome);
  const dirToCwd = new Map<string, string>();
  const cwdToSessions = new Map<string, typeof sessions>();

  for (const s of sessions) {
    const encoded = encodeProjectPath(s.cwd);
    dirToCwd.set(encoded, s.cwd);
    const list = cwdToSessions.get(s.cwd) || [];
    list.push(s);
    cwdToSessions.set(s.cwd, list);
  }

  const projects: ProjectInfo[] = [];
  for (const entry of fs.readdirSync(projectsDir).sort()) {
    const fullPath = path.join(projectsDir, entry);
    if (!fs.statSync(fullPath).isDirectory()) continue;

    const realPath = dirToCwd.get(entry) ?? decodeProjectDir(entry);
    const jsonlFiles = fs.readdirSync(fullPath).filter((f) => f.endsWith(".jsonl"));
    const projectSessions = cwdToSessions.get(realPath) || [];
    const hasActive = projectSessions.some((s) => isAlive(s.pid));

    projects.push({
      path: realPath,
      encoded_name: entry,
      session_count: jsonlFiles.length,
      has_active_session: hasActive,
    });
  }

  return projects;
}

export function getProjectDir(projectPath: string, claudeHome = "~/.claude"): string | undefined {
  const encoded = encodeProjectPath(projectPath);
  const fullPath = path.join(getProjectsDir(claudeHome), encoded);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory() ? fullPath : undefined;
}
