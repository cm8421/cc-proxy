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
if [ -f "$SCRIPT_DIR/.path" ] && [ -s "$SCRIPT_DIR/.path" ]; then
    _SAVED_PATH="$(cat "$SCRIPT_DIR/.path")"
    if [ -n "$_SAVED_PATH" ]; then
        export PATH="$_SAVED_PATH"
    fi
fi
# Fallback: if PATH is still too thin (no node), resolve from login shell
if ! command -v node >/dev/null 2>&1; then
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

# Launch cc-proxy via tsx
TSX="$SCRIPT_DIR/node_modules/.bin/tsx"
if [ ! -f "$TSX" ]; then
    echo "Error: tsx not found at $TSX" >&2
    echo "Re-run install: curl -fsSL https://raw.githubusercontent.com/cm8421/cc-proxy/main/install.sh | bash" >&2
    exit 1
fi
exec "$TSX" "$SCRIPT_DIR/src/index.ts" --transport stdio
