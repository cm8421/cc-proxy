"""Claude CLI subprocess management and stream-json parsing."""

import asyncio
import json
import time
from collections.abc import AsyncIterator

from .models import SendMessageResult, StreamEvent

_session_locks: dict[str, asyncio.Lock] = {}


def get_session_lock(session_id: str) -> asyncio.Lock:
    if session_id not in _session_locks:
        _session_locks[session_id] = asyncio.Lock()
    return _session_locks[session_id]


async def send_message(
    message: str,
    session_id: str,
    cwd: str,
    claude_cli_path: str = "claude",
    timeout: int = 300,
) -> AsyncIterator[StreamEvent]:
    """Send a message to a Claude Code session via CLI subprocess.

    Yields StreamEvent objects as they arrive from the CLI stream-json output.
    The final event will have is_final=True.
    """
    cmd = [
        claude_cli_path,
        "-p", message,
        "--resume", session_id,
        "--output-format", "stream-json",
        "--verbose",
        "--dangerously-skip-permissions",
    ]

    start = time.monotonic()

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    try:
        async for line in _read_lines(proc.stdout):
            event = _parse_stream_line(line)
            if event is not None:
                yield event
                if event.is_final:
                    return

        await asyncio.wait_for(proc.wait(), timeout=10)
    except asyncio.TimeoutError:
        proc.kill()
        yield StreamEvent(event_type="error", content="CLI timeout", is_final=True)
    finally:
        elapsed = int((time.monotonic() - start) * 1000)
        if proc.returncode is None:
            proc.kill()


async def create_new_session(
    cwd: str,
    name: str | None = None,
    claude_cli_path: str = "claude",
) -> tuple[str, str]:
    """Create a new Claude Code session. Returns (session_id, response_text)."""

    cmd = [
        claude_cli_path,
        "-p", "Session initialized.",
        "--output-format", "stream-json",
        "--dangerously-skip-permissions",
    ]
    if name:
        cmd.extend(["--name", name])

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    result_text = ""
    result_session_id = ""
    async for line in _read_lines(proc.stdout):
        try:
            data = json.loads(line.strip())
        except json.JSONDecodeError:
            continue
        if data.get("type") == "result":
            result_text = data.get("result", "")
            result_session_id = data.get("session_id", "")

    await proc.wait()
    return result_session_id, result_text


async def _read_lines(stream: asyncio.StreamReader | None) -> AsyncIterator[str]:
    if stream is None:
        return
    while True:
        line = await stream.readline()
        if not line:
            break
        yield line.decode("utf-8", errors="replace")


def _parse_stream_line(line: str) -> StreamEvent | None:
    try:
        data = json.loads(line.strip())
    except json.JSONDecodeError:
        return None

    msg_type = data.get("type")

    if msg_type == "result":
        return StreamEvent(
            event_type="result",
            content=data.get("result", ""),
            is_final=True,
        )

    if msg_type == "assistant":
        content_blocks = data.get("message", {}).get("content", [])
        texts = [
            b.get("text", "") for b in content_blocks
            if isinstance(b, dict) and b.get("type") == "text"
        ]
        if texts:
            return StreamEvent(
                event_type="assistant_text",
                content="".join(texts),
            )

    return None
