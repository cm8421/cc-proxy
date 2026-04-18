import json
import os
import tempfile

import pytest

from cc_proxy.session_store import get_session, is_alive, list_sessions


@pytest.fixture
def mock_claude_home(tmp_path):
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir()

    for pid, sid, cwd in [
        (100, "sid-aaa", "/Users/test/proj1"),
        (200, "sid-bbb", "/Users/test/proj2"),
    ]:
        (sessions_dir / f"{pid}.json").write_text(json.dumps({
            "pid": pid, "sessionId": sid, "cwd": cwd,
            "startedAt": 1000000 + pid * 1000, "kind": "interactive", "entrypoint": "cli",
        }))

    return str(tmp_path)


def test_list_sessions(mock_claude_home):
    sessions = list_sessions(mock_claude_home)
    assert len(sessions) == 2
    assert sessions[0].session_id == "sid-bbb"  # sorted by startedAt desc


def test_get_session_found(mock_claude_home):
    s = get_session("sid-aaa", mock_claude_home)
    assert s is not None
    assert s.cwd == "/Users/test/proj1"


def test_get_session_not_found(mock_claude_home):
    assert get_session("nonexistent", mock_claude_home) is None


def test_is_alive_current_process():
    assert is_alive(os.getpid()) is True


def test_is_alive_dead_pid():
    assert is_alive(999999999) is False
