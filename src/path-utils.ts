import path from "node:path";
import os from "node:os";

export function encodeProjectPath(absPath: string): string {
  return absPath.replace(/\//g, "-");
}

export function decodeProjectDir(dirName: string): string {
  return dirName.replace(/-/g, "/");
}

export function getProjectsDir(claudeHome: string): string {
  return path.join(os.homedir(), claudeHome.replace(/^~/, ""), "projects");
}

export function getSessionsDir(claudeHome: string): string {
  return path.join(os.homedir(), claudeHome.replace(/^~/, ""), "sessions");
}
