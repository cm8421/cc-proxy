#!/bin/bash
# ⚠️  WARNING: This script starts cc-proxy in stdio mode.
# It is designed to be called by Hermes MCP client, NOT to be run manually.
#
# To run cc-proxy standalone for testing, use HTTP mode instead:
#   npx tsx src/index.ts --transport streamable-http
#
if [ -t 0 ]; then
    echo "Error: run.sh is for Hermes MCP integration (stdio mode)." >&2
    echo "For standalone testing, run:" >&2
    echo "  npx tsx src/index.ts --transport streamable-http" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export HOME="${HOME:-$USERPROFILE}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.cache/nodejs/npm-global/bin"
exec npx tsx "$SCRIPT_DIR/src/index.ts" --transport stdio
