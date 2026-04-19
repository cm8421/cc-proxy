#!/bin/bash
# cc-proxy MCP Server Launcher (stdio mode)
# Called by MCP clients (Hermes, Claude Desktop, etc.).
# For standalone testing: npx tsx src/index.ts --transport streamable-http

if [ -t 0 ]; then
    echo "Error: run.sh is for MCP client integration (stdio mode)." >&2
    echo "For standalone testing, run:" >&2
    echo "  npx tsx src/index.ts --transport streamable-http" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

export HOME="${HOME:-$USERPROFILE}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.cache/nodejs/npm-global/bin"

# Load .env file (created by install.sh from your shell's ANTHROPIC_* vars)
if [ -f "$SCRIPT_DIR/.env" ]; then
    while IFS='=' read -r key value; do
        case "$key" in
            ''|\#*) continue ;;
        esac
        export "$key=$value"
    done < "$SCRIPT_DIR/.env"
fi

exec npx tsx "$SCRIPT_DIR/src/index.ts" --transport stdio
