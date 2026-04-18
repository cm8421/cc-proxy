"""Parse Claude Code JSONL session history for summaries."""

import json
import os
from pathlib import Path

from .path_utils import encode_project_path, get_claude_projects_dir


def _session_jsonl_path(session_id: str, cwd: str, claude_home: str = "~/.claude") -> Path | None:
    encoded = encode_project_path(cwd)
    jsonl_file = Path(get_claude_projects_dir(claude_home)) / encoded / f"{session_id}.jsonl"
    return jsonl_file if jsonl_file.exists() else None


def _extract_user_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return " ".join(parts)
    return ""


def get_last_user_messages(
    session_id: str,
    cwd: str,
    n: int = 3,
    max_chars: int = 200,
    claude_home: str = "~/.claude",
) -> list[str]:
    jsonl_path = _session_jsonl_path(session_id, cwd, claude_home)
    if jsonl_path is None:
        return []

    user_messages: list[str] = []
    try:
        with open(jsonl_path) as f:
            for line in f:
                try:
                    record = json.loads(line.strip())
                except json.JSONDecodeError:
                    continue

                if record.get("type") != "user":
                    continue
                msg = record.get("message", {})
                text = _extract_user_text(msg.get("content"))
                if text:
                    user_messages.append(text[:max_chars])
    except OSError:
        return []

    return user_messages[-n:]


def extract_summary(
    session_id: str,
    cwd: str,
    max_messages: int = 5,
    max_chars: int = 200,
    claude_home: str = "~/.claude",
) -> str:
    messages = get_last_user_messages(session_id, cwd, max_messages, max_chars, claude_home)
    if not messages:
        return "No messages in session"
    return " | ".join(messages)


def get_message_count(session_id: str, cwd: str, claude_home: str = "~/.claude") -> int:
    return len(get_last_user_messages(session_id, cwd, n=9999, max_chars=1, claude_home=claude_home))
