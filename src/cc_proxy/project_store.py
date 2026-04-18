"""Discover Claude Code projects from ~/.claude/projects/."""

import os
from pathlib import Path

from .models import ProjectInfo, SessionEntry
from .path_utils import decode_project_dir, encode_project_path, get_claude_projects_dir
from .session_store import is_alive, list_sessions


def list_projects(claude_home: str = "~/.claude") -> list[ProjectInfo]:
    projects_dir = get_claude_projects_dir(claude_home)
    if not os.path.isdir(projects_dir):
        return []

    sessions = list_sessions(claude_home)
    # Build dir_name -> cwd mapping from session data (authoritative)
    dir_to_cwd: dict[str, str] = {}
    cwd_to_sessions: dict[str, list[SessionEntry]] = {}
    for s in sessions:
        encoded = encode_project_path(s.cwd)
        dir_to_cwd[encoded] = s.cwd
        cwd_to_sessions.setdefault(s.cwd, []).append(s)

    projects = []
    for entry in sorted(os.listdir(projects_dir)):
        full_path = os.path.join(projects_dir, entry)
        if not os.path.isdir(full_path):
            continue

        real_path = dir_to_cwd.get(entry, decode_project_dir(entry))
        jsonl_count = len(list(Path(full_path).glob("*.jsonl")))
        project_sessions = cwd_to_sessions.get(real_path, [])
        has_active = any(is_alive(s.pid) for s in project_sessions)

        projects.append(ProjectInfo(
            path=real_path,
            encoded_name=entry,
            session_count=jsonl_count,
            has_active_session=has_active,
        ))

    return projects


def get_project_dir(project_path: str, claude_home: str = "~/.claude") -> str | None:
    encoded = encode_project_path(project_path)
    full_path = os.path.join(get_claude_projects_dir(claude_home), encoded)
    return full_path if os.path.isdir(full_path) else None
