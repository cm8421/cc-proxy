import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parse as parseYaml } from "yaml";
import type { Config } from "./types.js";

const defaults: Config = {
  host: "127.0.0.1",
  port: 8765,
  claude_cli_path: "claude",
  claude_home: "~/.claude",
  max_stream_timeout: 300,
  summary_max_messages: 5,
  summary_max_chars: 200,
};

export function loadConfig(configPath?: string): Config {
  const searchPaths = [
    configPath,
    process.env.CC_PROXY_CONFIG,
    "config.yaml",
    path.join(os.homedir(), ".cc-proxy", "config.yaml"),
  ];

  for (const p of searchPaths) {
    if (p && fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      const data = parseYaml(raw) || {};
      return {
        ...defaults,
        ...(data.server || {}),
        ...(data.claude || {}),
        ...(data.session || {}),
      };
    }
  }

  return { ...defaults };
}
