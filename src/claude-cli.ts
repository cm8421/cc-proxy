import { spawn, type ChildProcess } from "node:child_process";
import type { StreamEvent } from "./types.js";
import { resolveAuthEnv } from "./env-resolver.js";

const sessionLocks = new Map<string, Promise<void>>();
const STDIO: ["ignore", "pipe", "pipe"] = ["ignore", "pipe", "pipe"];

function getSessionLock(sessionId: string): { current: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const current = sessionLocks.get(sessionId) ?? Promise.resolve();
  const next = new Promise<void>((r) => {
    resolve = r;
    setTimeout(() => { try { r(); } catch {} }, 60_000);
  });
  const chained = current.then(() => next);
  sessionLocks.set(sessionId, chained);
  return { current: chained, resolve };
}

function buildSpawnOpts(cwd: string): Parameters<typeof spawn>[2] {
  return {
    cwd,
    env: { ...process.env, ...resolveAuthEnv() },
    stdio: STDIO,
  };
}

interface SendMessageOptions {
  message: string;
  sessionId: string;
  cwd: string;
  claudeCliPath?: string;
  timeout?: number;
  planMode?: boolean;
  forkSession?: boolean;
}

export function sendMessage({
  message,
  sessionId,
  cwd,
  claudeCliPath = "claude",
  timeout = 300,
  planMode = false,
  forkSession = false,
}: SendMessageOptions): Promise<StreamEvent[]> {
  const { current: lock, resolve } = getSessionLock(sessionId);

  return lock.then(() => {
    const args = [
      "-p", message,
      "--resume", sessionId,
      "--output-format", "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
    ];
    if (planMode) args.push("--permission-mode", "plan");
    if (forkSession) args.push("--fork-session");

    const proc = spawn(claudeCliPath, args, buildSpawnOpts(cwd));

    return collectStream(proc, timeout).finally(() => {
      resolve();
      killProc(proc);
    });
  });
}

interface CreateSessionOptions {
  cwd: string;
  name?: string;
  claudeCliPath?: string;
  timeout?: number;
}

export async function createNewSession({
  cwd,
  name,
  claudeCliPath = "claude",
  timeout = 300,
}: CreateSessionOptions): Promise<{ sessionId: string; response: string }> {
  const args = [
    "-p", "Session initialized.",
    "--output-format", "stream-json",
    "--verbose",
    "--dangerously-skip-permissions",
  ];
  if (name) args.push("--name", name);

  const proc = spawn(claudeCliPath, args, buildSpawnOpts(cwd));
  const events = await collectStream(proc, timeout);

  const resultEvent = events.find((e) => e.event_type === "result");
  return {
    sessionId: resultEvent?.session_id ?? "",
    response: resultEvent?.content ?? "",
  };
}

function collectStream(proc: ChildProcess, timeoutSec: number): Promise<StreamEvent[]> {
  return new Promise((resolve) => {
    const events: StreamEvent[] = [];
    let buffer = "";
    let stderrText = "";
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        events.push({ event_type: "error", content: "CLI timeout", is_final: true });
        killProc(proc);
        resolve(events);
      }
    }, timeoutSec * 1000);

    proc.stderr?.on("data", (d) => { stderrText += d.toString(); });

    proc.stdout?.on("data", (d) => {
      if (resolved) return;
      buffer += d.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseStreamLine(line);
        if (event) {
          events.push(event);
          if (event.is_final) {
            resolved = true;
            clearTimeout(timer);
            killProc(proc);
            resolve(events);
            return;
          }
        }
      }
    });

    proc.on("close", (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);

      if (buffer.trim()) {
        const event = parseStreamLine(buffer);
        if (event) events.push(event);
      }

      if (code !== 0 && code !== null && events.length === 0) {
        events.push({ event_type: "error", content: stderrText || `CLI exited with code ${code}`, is_final: true });
      }

      resolve(events);
    });
  });
}

function parseStreamLine(line: string): StreamEvent | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(line.trim());
  } catch {
    return null;
  }

  if (data.type === "result") {
    const sessionId = (data.session_id as string) ?? undefined;
    if (data.is_error) {
      const errors = data.errors as string[] | undefined;
      return {
        event_type: "error",
        content: errors?.join("; ") || (data.result as string) || "CLI error",
        is_final: true,
        session_id: sessionId,
      };
    }
    return {
      event_type: "result",
      content: (data.result as string) ?? "",
      is_final: true,
      session_id: sessionId,
    };
  }

  if (data.type === "assistant") {
    const msg = data.message as Record<string, unknown> | undefined;
    const content = (msg?.content ?? []) as Record<string, unknown>[];
    const texts = content
      .filter((b) => b.type === "text")
      .map((b) => (b.text as string) ?? "");
    if (texts.length > 0) {
      return { event_type: "assistant_text", content: texts.join(""), is_final: false };
    }
  }

  return null;
}

function killProc(proc: ChildProcess) {
  if (proc.exitCode === null) proc.kill();
}
