import fs from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { listProjects } from "./project-store.js";
import { getSession, isAlive, listSessions } from "./session-store.js";
import { extractSummary, getMessageCount, getLastUserMessages } from "./jsonl-reader.js";
import { sendMessage, createNewSession } from "./claude-cli.js";

export function createServer(): McpServer {
  const cfg = loadConfig();

  const server = new McpServer({
    name: "cc-proxy",
    version: "0.2.0",
  });

  server.registerTool(
    "cc_list_projects",
    {
      title: "List Claude Code Projects",
      description: `List all Claude Code projects on this machine.

Scans ~/.claude/projects/ for project directories and reports session counts and active status for each project.

Returns JSON array of objects:
{
  "path": "/Users/you/project",    // Project root path
  "encoded_name": "-Users-you-project",
  "session_count": 5,               // Total JSONL session files
  "has_active_session": true        // At least one running session
}`,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const projects = listProjects(cfg.claude_home);
      return { content: [{ type: "text", text: JSON.stringify(projects) }] };
    },
  );

  server.registerTool(
    "cc_list_sessions",
    {
      title: "List Claude Code Sessions",
      description: `List Claude Code sessions, optionally filtered by project path.
IMPORTANT: Both active and inactive sessions can receive messages via cc_send_to_session. Do NOT skip inactive sessions — they can be resumed automatically.

Each session entry includes:
- session_id: UUID for use with cc_send_to_session
- pid: Process ID
- cwd: Working directory of the session
- started_at: Session start time
- is_alive: Whether the Claude Code process is still running
- summary: Brief description of session activity
- message_count: Total messages in session history

Args:
  project_path (string, optional): Filter sessions by project directory
  limit (number, optional): Max sessions to return (default: 20, max: 100)
  offset (number, optional): Skip N sessions for pagination (default: 0)`,
      inputSchema: {
        project_path: z.string().optional().describe("Optional absolute path to filter by project"),
        limit: z.number().int().min(1).max(100).default(20).describe("Max sessions to return"),
        offset: z.number().int().min(0).default(0).describe("Skip N sessions for pagination"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ project_path, limit, offset }) => {
      let sessions = listSessions(cfg.claude_home);
      if (project_path) sessions = sessions.filter((s) => s.cwd === project_path);

      const active = sessions.filter((s) => isAlive(s.pid));
      const inactivePerProject = new Map<string, number>();
      const limitedInactive = sessions.filter((s) => {
        if (isAlive(s.pid)) return false;
        const count = inactivePerProject.get(s.cwd) ?? 0;
        if (count >= 2) return false;
        inactivePerProject.set(s.cwd, count + 1);
        return true;
      });

      const merged = [...active, ...limitedInactive];

      const total = merged.length;
      const paged = merged.slice(offset, offset + limit);

      const items = paged.map((s) => ({
        session_id: s.session_id,
        pid: s.pid,
        cwd: s.cwd,
        started_at: new Date(s.started_at).toLocaleString(),
        is_alive: isAlive(s.pid),
        summary: extractSummary(s.session_id, s.cwd, cfg.summary_max_messages, cfg.summary_max_chars, cfg.claude_home),
        message_count: getMessageCount(s.session_id, s.cwd, cfg.claude_home),
      }));

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            total,
            count: items.length,
            offset,
            has_more: total > offset + items.length,
            next_offset: total > offset + items.length ? offset + items.length : undefined,
            sessions: items,
          }),
        }],
      };
    },
  );

  server.registerTool(
    "cc_send_to_session",
    {
      title: "Send Message to Session",
      description: `Send a user message to a Claude Code session and wait for the response.
IMPORTANT: This works for BOTH active and inactive sessions. Claude CLI --resume can restore any session. Do NOT refuse to send to inactive sessions.

Resumes the session identified by session_id, sends the message, and returns the full response.

Args:
  session_id (string, required): UUID of the target session
  message (string, required): The user message to send (1-10000 characters)
  plan_mode (boolean, optional, default: false): Set to true to run Claude in plan-only mode.
    In plan mode, Claude analyzes code and produces an implementation plan but will NOT edit files or run destructive commands.

    When to use plan_mode=true:
    - The user wants to review a plan before executing changes
    - Exploring code, analyzing bugs, or answering questions (no edits needed)
    - Getting a second opinion on architecture decisions
    - Any read-only research or investigation task

    When NOT to use plan_mode (leave false or omit):
    - The user explicitly asks to make changes, fix bugs, or implement features
    - File edits, code generation, or command execution is expected

  fork_session (boolean, optional, default: false): Set to true to fork into a new session.
    The original session is not modified, and the response comes from a new session with its own ID.

    When to use fork_session=true:
    - Trying experimental changes without risking the original session
    - Multiple parallel tasks branching from the same conversation history
    - Creating alternative approaches from a shared starting point

Returns on success:
{
  "session_id": "uuid",
  "response": "Claude's response text",
  "stop_reason": "end_turn",
  "duration_ms": 12345
}

Returns on error:
{ "error": "Description of what went wrong and suggested fix" }

Errors:
  - "Session not found": The session_id does not match any known session
  - "Not logged in": ANTHROPIC_AUTH_TOKEN env var missing — configure in MCP client env
  - "CLI timeout": Response took longer than max_stream_timeout seconds`,
      inputSchema: {
        session_id: z.string().min(1).describe("The session UUID"),
        message: z.string().min(1).max(10000).describe("The user message to send (1-10000 characters)"),
        plan_mode: z.boolean().optional().default(false).describe("Set to true for plan-only mode (read-only, no edits). Use for analysis, review, and investigation tasks."),
        fork_session: z.boolean().optional().default(false).describe("Set to true to fork into a new session. Original session remains untouched. Use for experimental changes or parallel tasks."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ session_id, message, plan_mode, fork_session }) => {
      const session = getSession(session_id, cfg.claude_home);
      if (!session) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Session ${session_id} not found. Use cc_list_sessions to find valid session IDs.` }) }],
          isError: true,
        };
      }

      const start = Date.now();
      const events = await sendMessage({
        message,
        sessionId: session_id,
        cwd: session.cwd,
        claudeCliPath: cfg.claude_cli_path,
        timeout: cfg.max_stream_timeout,
        planMode: plan_mode,
        forkSession: fork_session,
      });

      const errorEvent = events.find((e) => e.event_type === "error");
      if (errorEvent) {
        const hint = errorEvent.content?.includes("Not logged in")
          ? " Configure ANTHROPIC_AUTH_TOKEN and ANTHROPIC_BASE_URL in your MCP client environment."
          : "";
        return {
          content: [{ type: "text", text: JSON.stringify({ error: errorEvent.content + hint }) }],
          isError: true,
        };
      }

      const resultEvent = events.find((e) => e.event_type === "result");
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            session_id,
            response: resultEvent?.content ?? "",
            stop_reason: "end_turn",
            duration_ms: Date.now() - start,
          }),
        }],
      };
    },
  );

  server.registerTool(
    "cc_create_session",
    {
      title: "Create New Session",
      description: `Create a new Claude Code session for a project directory.

Starts a Claude Code process in the given project directory and returns the new session info.
The project directory must exist on disk.

Args:
  project_path (string, required): Absolute path to the project directory
  name (string, optional): Display name for the session

Returns:
{
  "session_id": "uuid",
  "pid": 12345,
  "cwd": "/path/to/project",
  "started_at": 1713480000000,
  "is_alive": true
}

Note: Requires ANTHROPIC_AUTH_TOKEN and ANTHROPIC_BASE_URL to be configured in the MCP client environment.`,
      inputSchema: {
        project_path: z.string().min(1).describe("Absolute path to the project directory"),
        name: z.string().optional().describe("Optional display name for the session"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ project_path, name }) => {
      if (!fs.existsSync(project_path) || !fs.statSync(project_path).isDirectory()) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Directory does not exist: ${project_path}` }) }],
          isError: true,
        };
      }

      const { sessionId } = await createNewSession({
        cwd: project_path,
        name,
        claudeCliPath: cfg.claude_cli_path,
        timeout: cfg.max_stream_timeout,
      });
      if (!sessionId) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Failed to create session. Ensure ANTHROPIC_AUTH_TOKEN is configured in MCP client environment." }) }],
          isError: true,
        };
      }

      const session = getSession(sessionId, cfg.claude_home);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(
            session
              ? { session_id: session.session_id, pid: session.pid, cwd: session.cwd, started_at: session.started_at, is_alive: isAlive(session.pid) }
              : { session_id: sessionId, message: "Session created. Use cc_get_session_status to verify." },
          ),
        }],
      };
    },
  );

  server.registerTool(
    "cc_get_session_status",
    {
      title: "Get Session Status",
      description: `Check whether a Claude Code session process is still alive.

Note: Even if is_alive is false, the session can still receive messages via cc_send_to_session (resumes automatically). Do NOT treat inactive sessions as unusable.

Args:
  session_id (string, required): The session UUID

Returns:
{ "session_id": "uuid", "is_alive": true/false, "pid": 12345 }`,
      inputSchema: {
        session_id: z.string().min(1).describe("The session UUID"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ session_id }) => {
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

  server.registerTool(
    "cc_get_session_summary",
    {
      title: "Get Session Summary",
      description: `Get a summary of what a Claude Code session has been working on.

Extracts recent user messages and a brief summary from the session's JSONL history.
Useful for understanding session context before sending a new message.

Args:
  session_id (string, required): The session UUID

Returns:
{
  "session_id": "uuid",
  "cwd": "/path/to/project",
  "summary": "Brief description of session activity",
  "last_user_messages": ["msg1", "msg2", "msg3"]
}`,
      inputSchema: {
        session_id: z.string().min(1).describe("The session UUID"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ session_id }) => {
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
