#!/bin/bash
set -e

INSTALL_DIR="$HOME/cc-proxy"
HERMES_CONFIG="$HOME/.hermes/config.yaml"

# Clone if not already in repo
if [ ! -f "$(cd "$(dirname "$0")" 2>/dev/null && pwd)/src/cc_proxy/server.py" ]; then
    echo "==> Cloning cc-proxy..."
    rm -rf "$INSTALL_DIR"
    git clone https://github.com/cm8421/cc-proxy.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Installing dependencies..."
pip install -e "$REPO_DIR" -q

echo "==> Configuring Hermes..."

if [ ! -f "$HERMES_CONFIG" ]; then
    echo "Error: Hermes config not found at $HERMES_CONFIG"
    exit 1
fi

if grep -q "cc-proxy" "$HERMES_CONFIG"; then
    echo "    already configured, skipping."
else
    python3 -c "
import yaml

with open('$HERMES_CONFIG') as f:
    cfg = yaml.safe_load(f)

if 'mcp_servers' not in cfg or cfg['mcp_servers'] is None:
    cfg['mcp_servers'] = {}

cfg['mcp_servers']['cc-proxy'] = {
    'command': '$REPO_DIR/run.sh',
    'args': ['--transport', 'stdio']
}

with open('$HERMES_CONFIG', 'w') as f:
    yaml.dump(cfg, f, default_flow_style=False, allow_unicode=True)
"
    echo "    added to Hermes config."
fi

echo ""
echo "Done! Restart Hermes to activate cc-proxy."
