import fs from "node:fs";
import path from "node:path";

const AUTH_PREFIX = "ANTHROPIC_";
let cached: Record<string, string> | null = null;

export function resolveAuthEnv(): Record<string, string> {
  if (cached) return cached;

  const result: Record<string, string> = {};

  // Source 1 (lowest): .env file — check script dir and its parent
  const scriptDir = path.dirname(process.argv[1] ?? "");
  for (const dir of [scriptDir, path.join(scriptDir, ".."), process.cwd()]) {
    try {
      for (const line of fs.readFileSync(path.join(dir, ".env"), "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 0) continue;
        const key = trimmed.substring(0, eq).trim();
        const val = trimmed.substring(eq + 1).trim();
        if (key.startsWith(AUTH_PREFIX)) result[key] = val;
      }
      break;
    } catch { /* no .env in this dir */ }
  }

  // Source 2 (highest): process.env (MCP client env or run.sh exports)
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith(AUTH_PREFIX) && val) result[key] = val;
  }

  cached = result;
  return result;
}
