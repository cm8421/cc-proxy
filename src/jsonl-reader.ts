import fs from "node:fs";
import path from "node:path";
import { encodeProjectPath, getProjectsDir } from "./path-utils.js";

export function extractCwdFromJsonl(jsonlPath: string): string | undefined {
  let fd: number | undefined;
  try {
    fd = fs.openSync(jsonlPath, "r");
    const buf = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);

    const chunk = buf.toString("utf-8", 0, bytesRead);
    const lines = chunk.split("\n");
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      try {
        const record = JSON.parse(lines[i]);
        if (typeof record.cwd === "string") return record.cwd;
      } catch { continue; }
    }
  } catch { /* ignore */ }
  finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  return undefined;
}

function sessionJsonlPath(sessionId: string, cwd: string, claudeHome = "~/.claude"): string | undefined {
  const encoded = encodeProjectPath(cwd);
  const file = path.join(getProjectsDir(claudeHome), encoded, `${sessionId}.jsonl`);
  return fs.existsSync(file) ? file : undefined;
}

function extractUserText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null && b.type === "text")
      .map((b) => (typeof b.text === "string" ? b.text : ""))
      .join(" ");
  }
  return "";
}

export function getLastUserMessages(
  sessionId: string,
  cwd: string,
  n = 3,
  maxChars = 200,
  claudeHome = "~/.claude",
): string[] {
  const filePath = sessionJsonlPath(sessionId, cwd, claudeHome);
  if (!filePath) return [];

  const messages: string[] = [];
  try {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    for (const line of lines) {
      let record: Record<string, unknown>;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (record.type !== "user") continue;
      const msg = record.message as Record<string, unknown> | undefined;
      if (!msg) continue;
      const text = extractUserText(msg.content);
      if (text) messages.push(text.slice(0, maxChars));
    }
  } catch {
    return [];
  }

  return messages.slice(-n);
}

export function extractSummary(
  sessionId: string,
  cwd: string,
  maxMessages = 5,
  maxChars = 200,
  claudeHome = "~/.claude",
): string {
  const messages = getLastUserMessages(sessionId, cwd, maxMessages, maxChars, claudeHome);
  if (messages.length === 0) return "No messages in session";
  return messages.join(" | ");
}

export function getMessageCount(sessionId: string, cwd: string, claudeHome = "~/.claude"): number {
  return getLastUserMessages(sessionId, cwd, 9999, 1, claudeHome).length;
}
