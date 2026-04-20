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

function mapYamlConfig(data: Record<string, unknown>): Config {
  const server = (data.server || {}) as Record<string, unknown>;
  const claude = (data.claude || {}) as Record<string, unknown>;
  const session = (data.session || {}) as Record<string, unknown>;

  return {
    ...defaults,
    host: (server.host as string) ?? defaults.host,
    port: (server.port as number) ?? defaults.port,
    claude_cli_path: (claude.cli_path ?? claude.claude_cli_path ?? defaults.claude_cli_path) as string,
    claude_home: (claude.home ?? claude.claude_home ?? defaults.claude_home) as string,
    max_stream_timeout: (session.max_stream_timeout ?? defaults.max_stream_timeout) as number,
    summary_max_messages: (session.summary_max_messages ?? defaults.summary_max_messages) as number,
    summary_max_chars: (session.summary_max_chars ?? defaults.summary_max_chars) as number,
  };
}

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
      return mapYamlConfig(data);
    }
  }

  return { ...defaults };
}
