import { spawn, type ChildProcess } from "node:child_process";
import type { StreamEvent } from "./types.js";

const sessionLocks = new Map<string, Promise<void>>();

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

export async function* sendMessage(
  message: string,
  sessionId: string,
  cwd: string,
  claudeCliPath = "claude",
  timeout = 300,
): AsyncGenerator<StreamEvent> {
  const { current: lock, resolve } = getSessionLock(sessionId);
  await lock;

  const cmd = [
    claudeCliPath,
    "-p", message,
    "--resume", sessionId,
    "--output-format", "stream-json",
    "--verbose",
    "--dangerously-skip-permissions",
  ];

  const proc = spawn(cmd[0], cmd.slice(1), { cwd, env: process.env });

  try {
    yield* parseStream(proc, timeout);
  } finally {
    resolve();
    killProc(proc);
  }
}

export async function createNewSession(
  cwd: string,
  name?: string,
  claudeCliPath = "claude",
): Promise<{ sessionId: string; response: string }> {
  const cmd = [
    claudeCliPath,
    "-p", "Session initialized.",
    "--output-format", "stream-json",
    "--dangerously-skip-permissions",
  ];
  if (name) cmd.push("--name", name);

  const proc = spawn(cmd[0], cmd.slice(1), { cwd, env: process.env });
  let resultText = "";
  let resultSessionId = "";
  let buffer = "";

  const stdout = proc.stdout;
  if (stdout) {
    for await (const chunk of stdout) {
      buffer += chunk.toString();
    }
  }

  await waitProc(proc);

  for (const line of buffer.split("\n")) {
    try {
      const data = JSON.parse(line.trim());
      if (data.type === "result") {
        resultText = data.result ?? "";
        resultSessionId = data.session_id ?? "";
      }
    } catch {
      continue;
    }
  }

  return { sessionId: resultSessionId, response: resultText };
}

async function* parseStream(proc: ChildProcess, timeoutSec: number): AsyncGenerator<StreamEvent> {
  const stdout = proc.stdout;
  if (!stdout) {
    yield { event_type: "error", content: "No stdout from CLI process", is_final: true };
    return;
  }

  let buffer = "";
  let stderrText = "";

  proc.stderr?.on("data", (d) => { stderrText += d.toString(); });

  const timer = setTimeout(() => {
    killProc(proc);
  }, timeoutSec * 1000);

  try {
    for await (const chunk of stdout) {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseStreamLine(line);
        if (event) {
          yield event;
          if (event.is_final) return;
        }
      }
    }

    if (buffer.trim()) {
      const event = parseStreamLine(buffer);
      if (event) yield event;
    }

    const code = await waitProc(proc);
    if (code !== 0 && code !== null) {
      yield { event_type: "error", content: stderrText || `CLI exited with code ${code}`, is_final: true };
    }
  } finally {
    clearTimeout(timer);
  }
}

function parseStreamLine(line: string): StreamEvent | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(line.trim());
  } catch {
    return null;
  }

  const type = data.type as string;

  if (type === "result") {
    return {
      event_type: "result",
      content: (data.result as string) ?? "",
      is_final: true,
    };
  }

  if (type === "assistant") {
    const msg = data.message as Record<string, unknown> | undefined;
    const content = (msg?.content ?? []) as Record<string, unknown>[];
    const texts = content
      .filter((b) => b.type === "text")
      .map((b) => (b.text as string) ?? "");
    if (texts.length > 0) {
      return {
        event_type: "assistant_text",
        content: texts.join(""),
        is_final: false,
      };
    }
  }

  return null;
}

function killProc(proc: ChildProcess) {
  if (proc.exitCode === null) proc.kill();
}

function waitProc(proc: ChildProcess): Promise<number | null> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null) { resolve(proc.exitCode); return; }
    proc.on("exit", (code) => resolve(code));
  });
}
