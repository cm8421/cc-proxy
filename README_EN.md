# cc-proxy

An MCP Server that bridges external agents with local Claude Code CLI sessions — control your coding sessions from any MCP client.

```
Phone IM → Agent (MCP Client) → cc-proxy (MCP Server) → Claude CLI → Claude Code Session
```

## Features

- Discover all local Claude Code projects and sessions
- Send messages to any active session and get responses
- Create new Claude Code sessions for a project
- Query session status and conversation summaries

## MCP Tools

| Tool | Description | Read-only |
|------|-------------|-----------|
| `cc_list_projects` | List all Claude Code projects on this machine | Yes |
| `cc_list_sessions` | List sessions with pagination and project filtering | Yes |
| `cc_send_to_session` | Send a message to a session and get the response | No |
| `cc_create_session` | Create a new session for a project | No |
| `cc_get_session_status` | Check if a session process is alive | Yes |
| `cc_get_session_summary` | Get a summary of session activity | Yes |

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/cm8421/cc-proxy/main/install.sh | bash
```

One command to clone, install dependencies, and configure Hermes. Restart Hermes to activate.

## Environment Variables

cc-proxy needs your Claude Code API credentials to communicate with the claude CLI.

### Auto-configured during install (Recommended)

The one-line installer auto-detects `ANTHROPIC_*` env vars from your terminal and saves them to `.env`:

```bash
# Run from a terminal where Claude Code is active
curl -fsSL https://raw.githubusercontent.com/cm8421/cc-proxy/main/install.sh | bash
```

If `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN` etc. are set in your shell, the installer captures them automatically.

### Manual `.env` file

If credentials were not detected during install, create `.env` manually:

```bash
cat > ~/.cc-proxy/.env << 'EOF'
ANTHROPIC_BASE_URL=https://your-api-endpoint
ANTHROPIC_AUTH_TOKEN=your-token
EOF
```

### Hermes config env

Alternatively, pass credentials via the `env` field in Hermes config (no `.env` needed):

```yaml
mcp_servers:
  cc-proxy:
    command: ~/.cc-proxy/run.sh
    args:
      - --transport
      - stdio
    env:
      ANTHROPIC_BASE_URL: https://your-api-endpoint
      ANTHROPIC_AUTH_TOKEN: your-token
```

### Common Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_BASE_URL` | API endpoint URL | With proxy |
| `ANTHROPIC_AUTH_TOKEN` | API auth token | With proxy |
| `ANTHROPIC_API_KEY` | Official Anthropic API key | With official API |
| `ANTHROPIC_MODEL` | Default model | Optional |

### Troubleshooting

**"Not logged in" error**: `.env` file is missing or credentials are invalid. Check with `cat ~/.cc-proxy/.env`.

## Project Structure

```
src/
├── index.ts           # Entry point, argument parsing, server startup
├── server.ts          # McpServer, registers 6 MCP tools
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
