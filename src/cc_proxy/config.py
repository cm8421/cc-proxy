import os
from pathlib import Path

import yaml
from pydantic import BaseModel


class CCProxyConfig(BaseModel):
    host: str = "127.0.0.1"
    port: int = 8765
    claude_cli_path: str = "claude"
    claude_home: str = "~/.claude"
    max_stream_timeout: int = 300
    summary_max_messages: int = 5
    summary_max_chars: int = 200


def load_config(config_path: str | None = None) -> CCProxyConfig:
    search_paths = [
        config_path,
        os.environ.get("CC_PROXY_CONFIG"),
        "config.yaml",
        os.path.expanduser("~/.cc-proxy/config.yaml"),
    ]

    for path in search_paths:
        if path and Path(path).exists():
            with open(path) as f:
                data = yaml.safe_load(f) or {}
            flat = {**data.get("server", {}), **data.get("claude", {}), **data.get("session", {})}
            return CCProxyConfig(**flat)

    return CCProxyConfig()
