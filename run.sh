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

# Load saved PATH from install (fast), or resolve from login shell (reliable)
if [ -f "$SCRIPT_DIR/.path" ]; then
    export PATH="$(cat "$SCRIPT_DIR/.path")"
else
    _RESOLVED=$(${SHELL:-/bin/bash} -l -c 'echo "$PATH"' 2>/dev/null || true)
    [ -n "$_RESOLVED" ] && export PATH="$_RESOLVED"
fi

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
