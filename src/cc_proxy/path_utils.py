"""Encode/decode project paths for Claude's directory naming scheme.

Claude uses path.replace("/", "-") to create directory names under ~/.claude/projects/.
E.g. /Users/chenming/projects/cc-proxy -> -Users-chenming-projects-cc-proxy
"""

import os


def encode_project_path(abs_path: str) -> str:
    return abs_path.replace("/", "-")


def decode_project_dir(dir_name: str) -> str:
    return dir_name.replace("-", "/")


def get_claude_projects_dir(claude_home: str) -> str:
    return os.path.join(os.path.expanduser(claude_home), "projects")


def get_claude_sessions_dir(claude_home: str) -> str:
    return os.path.join(os.path.expanduser(claude_home), "sessions")
