#!/bin/bash
# cc-proxy launcher - defaults to stdio for Hermes MCP integration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PYTHONPATH="$SCRIPT_DIR/src"
exec /opt/homebrew/bin/python3 -m cc_proxy.server --transport stdio
