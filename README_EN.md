# cc-proxy

An MCP Server that bridges [Hermes Agent](https://github.com/nicepkg/hermes) with local Claude Code CLI sessions — control your coding sessions from your phone.

```
Phone IM → Hermes Agent (MCP Client) → cc-proxy (MCP Server) → Claude CLI → Claude Code Session
```

## Features

- Discover all local Claude Code projects and sessions
- Send messages to any active session and get responses
- Create new Claude Code sessions for a project
- Query session status and conversation summaries

## MCP Tools

| Tool | Description |
|------|-------------|
| `list_projects` | List all Claude Code projects on this machine |
| `list_sessions` | List sessions, optionally filtered by project path |
| `send_to_session` | Send a message to a session and get the response |
| `create_session` | Create a new session for a project |
| `get_session_status` | Check if a session process is alive |
| `get_session_summary` | Get a summary of session activity |

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/cm8421/cc-proxy/main/install.sh | bash
```

One command to clone, install dependencies, and configure Hermes. Restart Hermes to activate.

## Manual Configuration

Add the following to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  cc-proxy:
    command: /path/to/cc-proxy/run.sh
    args:
      - --transport
      - stdio
```

## Project Structure

```
src/
├── index.ts           # Entry point, argument parsing, server startup
├── server.ts          # McpServer, registers MCP tools
├── claude-cli.ts      # Claude CLI subprocess management + stream-json parsing
├── session-store.ts   # Discover sessions from ~/.claude/sessions/
├── project-store.ts   # Discover projects from ~/.claude/projects/
├── jsonl-reader.ts    # JSONL conversation history parsing
├── path-utils.ts      # Project path encoding/decoding
├── types.ts           # TypeScript type definitions
└── config.ts          # Configuration loading
```

## Requirements

- Node.js >= 18
- Claude Code CLI (`claude` command available)

[中文](README.md)

## License

[Apache 2.0](LICENSE)
