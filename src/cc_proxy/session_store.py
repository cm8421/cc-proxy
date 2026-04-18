"""Discover Claude Code sessions from ~/.claude/sessions/*.json."""

import json
import os
from pathlib import Path

from .models import SessionEntry
from .path_utils import get_claude_sessions_dir


def list_sessions(claude_home: str = "~/.claude") -> list[SessionEntry]:
    sessions_dir = get_claude_sessions_dir(claude_home)
    if not os.path.isdir(sessions_dir):
        return []

    entries = []
    for f in Path(sessions_dir).glob("*.json"):
        try:
            data = json.loads(f.read_text())
            entries.append(SessionEntry(
                pid=data["pid"],
                session_id=data["sessionId"],
                cwd=data["cwd"],
                started_at=data["startedAt"],
                kind=data.get("kind", "interactive"),
                entrypoint=data.get("entrypoint", "cli"),
            ))
        except (json.JSONDecodeError, KeyError):
            continue

    entries.sort(key=lambda s: s.started_at, reverse=True)
    return entries


def get_session(session_id: str, claude_home: str = "~/.claude") -> SessionEntry | None:
    for entry in list_sessions(claude_home):
        if entry.session_id == session_id:
            return entry
    return None


def is_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False
