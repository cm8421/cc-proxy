import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { listProjects } from "./project-store.js";
import { getSession, isAlive, listSessions } from "./session-store.js";
import { extractSummary, getMessageCount, getLastUserMessages } from "./jsonl-reader.js";
import { sendMessage, createNewSession } from "./claude-cli.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "cc-proxy",
    version: "0.1.0",
  });

  server.tool("list_projects", "List all Claude Code projects on this machine", {}, async () => {
    const cfg = loadConfig();
    const projects = listProjects(cfg.claude_home);
    return { content: [{ type: "text", text: JSON.stringify(projects) }] };
  });

  server.tool(
    "list_sessions",
    "List Claude Code sessions, optionally filtered by project path",
    { project_path: z.string().optional().describe("Optional absolute path to filter by project") },
    async ({ project_path }) => {
      const cfg = loadConfig();
      let sessions = listSessions(cfg.claude_home);
      if (project_path) sessions = sessions.filter((s) => s.cwd === project_path);

      const results = sessions.map((s) => {
        const alive = isAlive(s.pid);
        const summary = alive
          ? extractSummary(s.session_id, s.cwd, cfg.summary_max_messages, cfg.summary_max_chars, cfg.claude_home)
          : null;
        const messageCount = getMessageCount(s.session_id, s.cwd, cfg.claude_home);
        return {
          session_id: s.session_id,
          pid: s.pid,
          cwd: s.cwd,
          started_at: s.started_at,
          is_alive: alive,
          summary,
          message_count: messageCount,
        };
      });

      return { content: [{ type: "text", text: JSON.stringify(results) }] };
    },
  );

  server.tool(
    "send_to_session",
    "Send a message to a specific Claude Code session and get the response",
    {
      session_id: z.string().describe("The session UUID"),
      message: z.string().describe("The user message to send"),
    },
    async ({ session_id, message }, extra) => {
      const cfg = loadConfig();
      const session = getSession(session_id, cfg.claude_home);
      if (!session) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Session ${session_id} not found.` }) }],
          isError: true,
        };
      }
      if (!isAlive(session.pid)) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Session process (PID ${session.pid}) is not running.` }) }],
          isError: true,
        };
      }

      const start = Date.now();
      let fullResponse = "";

      for await (const event of sendMessage(message, session_id, session.cwd, cfg.claude_cli_path, cfg.max_stream_timeout)) {
        if (event.event_type === "result") {
          fullResponse = event.content ?? "";
        } else if (event.event_type === "error") {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: event.content }) }],
            isError: true,
          };
        }
      }

      const durationMs = Date.now() - start;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            session_id,
            response: fullResponse,
            stop_reason: "end_turn",
            duration_ms: durationMs,
          }),
        }],
      };
    },
  );

  server.tool(
    "create_session",
    "Create a new Claude Code session for a project",
    {
      project_path: z.string().describe("Absolute path to the project directory"),
      name: z.string().optional().describe("Optional display name"),
    },
    async ({ project_path, name }) => {
      const cfg = loadConfig();
      const fs = await import("node:fs");
      if (!fs.existsSync(project_path) || !fs.statSync(project_path).isDirectory()) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Directory does not exist: ${project_path}` }) }],
          isError: true,
        };
      }

      const { sessionId } = await createNewSession(project_path, name, cfg.claude_cli_path);
      if (!sessionId) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Failed to create session." }) }],
          isError: true,
        };
      }

      const session = getSession(sessionId, cfg.claude_home);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(
            session
              ? {
                  session_id: session.session_id,
                  pid: session.pid,
                  cwd: session.cwd,
                  started_at: session.started_at,
                  is_alive: isAlive(session.pid),
                }
              : { session_id: sessionId, message: "Session created but not yet visible." },
          ),
        }],
      };
    },
  );

  server.tool(
    "get_session_status",
    "Check if a Claude Code session process is still alive",
    { session_id: z.string().describe("The session UUID") },
    async ({ session_id }) => {
      const cfg = loadConfig();
      const session = getSession(session_id, cfg.claude_home);
      if (!session) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Session ${session_id} not found.` }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ session_id, is_alive: isAlive(session.pid), pid: session.pid }),
        }],
      };
    },
  );

  server.tool(
    "get_session_summary",
    "Get a summary of what a session has been working on",
    { session_id: z.string().describe("The session UUID") },
    async ({ session_id }) => {
      const cfg = loadConfig();
      const session = getSession(session_id, cfg.claude_home);
      if (!session) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Session ${session_id} not found.` }) }],
          isError: true,
        };
      }

      const summary = extractSummary(session_id, session.cwd, cfg.summary_max_messages, cfg.summary_max_chars, cfg.claude_home);
      const lastMsgs = getLastUserMessages(session_id, session.cwd, 3, 200, cfg.claude_home);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ session_id, cwd: session.cwd, summary, last_user_messages: lastMsgs }),
        }],
      };
    },
  );

  return server;
}
