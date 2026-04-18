from pydantic import BaseModel


class ProjectInfo(BaseModel):
    path: str
    encoded_name: str
    session_count: int
    has_active_session: bool


class SessionEntry(BaseModel):
    pid: int
    session_id: str
    cwd: str
    started_at: int
    kind: str
    entrypoint: str


class SessionInfo(BaseModel):
    session_id: str
    pid: int
    cwd: str
    started_at: int
    is_alive: bool
    summary: str | None = None
    message_count: int = 0


class SendMessageResult(BaseModel):
    session_id: str
    response: str
    stop_reason: str
    duration_ms: int
    cost_usd: float | None = None


class SessionStatus(BaseModel):
    session_id: str
    is_alive: bool
    pid: int


class SessionSummary(BaseModel):
    session_id: str
    cwd: str
    summary: str
    last_user_messages: list[str]


class StreamEvent(BaseModel):
    event_type: str  # "assistant_text" | "tool_call" | "result" | "error"
    content: str | None = None
    is_final: bool = False
