#!/bin/bash
set -e

INSTALL_DIR="$HOME/cc-proxy"
HERMES_CONFIG="$HOME/.hermes/config.yaml"

# Clone if not already in repo
if [ ! -f "$(cd "$(dirname "$0")" 2>/dev/null && pwd)/src/index.ts" ]; then
    echo "==> Cloning cc-proxy..."
    rm -rf "$INSTALL_DIR"
    git clone https://github.com/cm8421/cc-proxy.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Installing dependencies..."
cd "$REPO_DIR" && npm install --production

echo "==> Configuring Hermes..."

if [ ! -f "$HERMES_CONFIG" ]; then
    echo "Error: Hermes config not found at $HERMES_CONFIG"
    exit 1
fi

if grep -q "cc-proxy" "$HERMES_CONFIG"; then
    echo "    already configured, skipping."
else
    node -e "
const fs = require('fs');
const path = '$HERMES_CONFIG';
const yaml = require('yaml');
const cfg = yaml.parse(fs.readFileSync(path, 'utf-8'));
if (!cfg.mcp_servers) cfg.mcp_servers = {};
cfg.mcp_servers['cc-proxy'] = {
    command: '$REPO_DIR/run.sh',
    args: ['--transport', 'stdio']
};
fs.writeFileSync(path, yaml.stringify(cfg));
"
    echo "    added to Hermes config."
fi

echo ""
echo "Done! Restart Hermes to activate cc-proxy."
