#!/bin/bash
# ⚠️  WARNING: This script starts cc-proxy in stdio mode.
# It is designed to be called by Hermes MCP client, NOT to be run manually.
#
# To run cc-proxy standalone for testing, use HTTP mode instead:
#   python3 -m cc_proxy.server --transport streamable-http
#
if [ -t 0 ]; then
    echo "Error: run.sh is for Hermes MCP integration (stdio mode)." >&2
    echo "For standalone testing, run:" >&2
    echo "  python3 -m cc_proxy.server --transport streamable-http" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PYTHONPATH="$SCRIPT_DIR/src"
exec /opt/homebrew/bin/python3 -m cc_proxy.server --transport stdio
