import json
import os

import pytest

from cc_proxy.jsonl_reader import extract_summary, get_last_user_messages


@pytest.fixture
def mock_claude_home(tmp_path):
    encoded = "-Users-test-myproject"
    proj_dir = tmp_path / "projects" / encoded
    proj_dir.mkdir(parents=True)

    lines = [
        {"type": "system", "message": "init"},
        {"type": "user", "message": {"role": "user", "content": "Hello world"}},
        {"type": "assistant", "message": {"role": "assistant", "content": [{"type": "text", "text": "Hi there"}]}},
        {"type": "user", "message": {"role": "user", "content": "Fix the bug"}},
        {"type": "assistant", "message": {"role": "assistant", "content": [{"type": "text", "text": "Done"}]}},
        {"type": "user", "message": {"role": "user", "content": "Run tests"}},
    ]
    jsonl_file = proj_dir / "sid-test.jsonl"
    with open(jsonl_file, "w") as f:
        for line in lines:
            f.write(json.dumps(line) + "\n")

    return str(tmp_path)


def test_get_last_user_messages(mock_claude_home):
    msgs = get_last_user_messages("sid-test", "/Users/test/myproject", n=2, claude_home=mock_claude_home)
    assert len(msgs) == 2
    assert msgs[0] == "Fix the bug"
    assert msgs[1] == "Run tests"


def test_extract_summary(mock_claude_home):
    summary = extract_summary("sid-test", "/Users/test/myproject", claude_home=mock_claude_home)
    assert "Hello world" in summary
    assert "Fix the bug" in summary


def test_missing_session(mock_claude_home):
    msgs = get_last_user_messages("nonexistent", "/no/path", claude_home=mock_claude_home)
    assert msgs == []
