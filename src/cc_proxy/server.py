"""cc-proxy MCP Server - bridges Hermes Agent with Claude Code sessions."""

import argparse
import asyncio
import json
import os
import time

from mcp.server.fastmcp import Context, FastMCP

from .claude_cli import create_new_session, get_session_lock, send_message
from .config import load_config
from .jsonl_reader import extract_summary, get_last_user_messages, get_message_count
from .models import SendMessageResult, SessionInfo, SessionStatus, SessionSummary
from .project_store import list_projects
from .session_store import get_session, is_alive, list_sessions


def create_server(host: str = "127.0.0.1", port: int = 8765) -> FastMCP:
    server = FastMCP(
        name="cc-proxy",
        instructions="Bridge to local Claude Code sessions. Use list_projects to discover projects, list_sessions to find sessions, send_to_session to interact.",
        host=host,
        port=port,
    )

    @server.tool()
    async def list_projects_tool() -> str:
        """List all Claude Code projects on this machine with session counts."""
        cfg = load_config()
        projects = list_projects(cfg.claude_home)
        return json.dumps([p.model_dump() for p in projects], ensure_ascii=False)

    @server.tool()
    async def list_sessions_tool(project_path: str | None = None) -> str:
        """List Claude Code sessions, optionally filtered by project path.

        Args:
            project_path: Optional absolute path to filter by project directory.
        """
        cfg = load_config()
        sessions = list_sessions(cfg.claude_home)

        if project_path:
            sessions = [s for s in sessions if s.cwd == project_path]

        results = []
        for s in sessions:
            alive = is_alive(s.pid)
            summary = extract_summary(s.session_id, s.cwd, cfg.summary_max_messages, cfg.summary_max_chars, cfg.claude_home) if alive else None
            count = get_message_count(s.session_id, s.cwd, cfg.claude_home)
            results.append(SessionInfo(
                session_id=s.session_id,
                pid=s.pid,
                cwd=s.cwd,
                started_at=s.started_at,
                is_alive=alive,
                summary=summary,
                message_count=count,
            ).model_dump())

        return json.dumps(results, ensure_ascii=False)

    @server.tool()
    async def send_to_session_tool(session_id: str, message: str, ctx: Context) -> str:
        """Send a message to a specific Claude Code session and get the response.

        Args:
            session_id: The session UUID to send a message to.
            message: The user message to send.
        """
        cfg = load_config()

        session = get_session(session_id, cfg.claude_home)
        if session is None:
            return json.dumps({"error": f"Session {session_id} not found. Use list_sessions to discover available sessions."})

        if not is_alive(session.pid):
            return json.dumps({"error": f"Session process (PID {session.pid}) is not running. Use create_session to start a new one."})

        lock = get_session_lock(session_id)
        if lock.locked():
            return json.dumps({"error": f"Session {session_id} is busy with another request. Please try again."})

        async with lock:
            start = time.monotonic()
            full_response = ""

            async for event in send_message(message, session_id, session.cwd, cfg.claude_cli_path, cfg.max_stream_timeout):
                if event.event_type == "result":
                    full_response = event.content or ""
                elif event.event_type == "error":
                    return json.dumps({"error": event.content})
                elif event.event_type == "assistant_text" and event.content:
                    await ctx.report_progress(50, 100, "Receiving response...")

            duration = int((time.monotonic() - start) * 1000)
            return SendMessageResult(
                session_id=session_id,
                response=full_response,
                stop_reason="end_turn",
                duration_ms=duration,
            ).model_dump_json()

    @server.tool()
    async def create_session_tool(project_path: str, name: str | None = None) -> str:
        """Create a new Claude Code session for a project.

        Args:
            project_path: Absolute path to the project directory.
            name: Optional display name for the session.
        """
        cfg = load_config()

        if not os.path.isdir(project_path):
            return json.dumps({"error": f"Directory does not exist: {project_path}"})

        new_id, _ = await create_new_session(project_path, name, cfg.claude_cli_path)

        if not new_id:
            return json.dumps({"error": "Failed to create session. Check Claude CLI availability."})

        session = get_session(new_id, cfg.claude_home)
        if session is None:
            return json.dumps({"session_id": new_id, "message": "Session created but not yet visible in session list."})

        return SessionInfo(
            session_id=session.session_id,
            pid=session.pid,
            cwd=session.cwd,
            started_at=session.started_at,
            is_alive=is_alive(session.pid),
        ).model_dump_json()

    @server.tool()
    async def get_session_status_tool(session_id: str) -> str:
        """Check whether a Claude Code session process is still alive.

        Args:
            session_id: The session UUID to check.
        """
        cfg = load_config()
        session = get_session(session_id, cfg.claude_home)
        if session is None:
            return json.dumps({"error": f"Session {session_id} not found."})

        return SessionStatus(
            session_id=session_id,
            is_alive=is_alive(session.pid),
            pid=session.pid,
        ).model_dump_json()

    @server.tool()
    async def get_session_summary_tool(session_id: str) -> str:
        """Get a summary of what a session has been working on.

        Args:
            session_id: The session UUID.
        """
        cfg = load_config()
        session = get_session(session_id, cfg.claude_home)
        if session is None:
            return json.dumps({"error": f"Session {session_id} not found."})

        summary = extract_summary(session_id, session.cwd, cfg.summary_max_messages, cfg.summary_max_chars, cfg.claude_home)
        last_msgs = get_last_user_messages(session_id, session.cwd, 3, 200, cfg.claude_home)

        return SessionSummary(
            session_id=session_id,
            cwd=session.cwd,
            summary=summary,
            last_user_messages=last_msgs,
        ).model_dump_json()

    return server


mcp = create_server()


def main():
    parser = argparse.ArgumentParser(description="cc-proxy: Claude Code MCP Server")
    parser.add_argument("--config", help="Path to config.yaml")
    parser.add_argument("--transport", choices=["streamable-http", "stdio"], default="streamable-http")
    parser.add_argument("--host", default=None)
    parser.add_argument("--port", type=int, default=None)
    args = parser.parse_args()

    cfg = load_config(args.config)
    host = args.host or cfg.host
    port = args.port or cfg.port

    server = create_server(host=host, port=port)

    if args.transport == "stdio":
        server.run(transport="stdio")
    else:
        server.run(transport="streamable-http")


if __name__ == "__main__":
    main()
