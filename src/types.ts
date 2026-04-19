export interface ProjectInfo {
  path: string;
  encoded_name: string;
  session_count: number;
  has_active_session: boolean;
}

export interface SessionEntry {
  pid: number;
  session_id: string;
  cwd: string;
  started_at: number;
  kind: string;
  entrypoint: string;
}

export interface SessionInfo {
  session_id: string;
  pid: number;
  cwd: string;
  started_at: number;
  is_alive: boolean;
  summary: string | null;
  message_count: number;
}

export interface SendMessageResult {
  session_id: string;
  response: string;
  stop_reason: string;
  duration_ms: number;
  cost_usd: number | null;
}

export interface SessionStatus {
  session_id: string;
  is_alive: boolean;
  pid: number;
}

export interface SessionSummary {
  session_id: string;
  cwd: string;
  summary: string;
  last_user_messages: string[];
}

export interface StreamEvent {
  event_type: "assistant_text" | "result" | "error";
  content?: string;
  is_final: boolean;
  session_id?: string;
}

export interface Config {
  host: string;
  port: number;
  claude_cli_path: string;
  claude_home: string;
  max_stream_timeout: number;
  summary_max_messages: number;
  summary_max_chars: number;
}
