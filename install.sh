#!/bin/bash
set -e

INSTALL_DIR="$HOME/.cc-proxy"
HERMES_CONFIG="$HOME/.hermes/config.yaml"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# Clone if not already in repo
if [ ! -f "$REPO_DIR/src/index.ts" ]; then
    echo "==> Cloning cc-proxy..."
    rm -rf "$INSTALL_DIR"
    git clone https://github.com/cm8421/cc-proxy.git "$INSTALL_DIR"
    REPO_DIR="$INSTALL_DIR"
fi

echo "==> Installing dependencies..."
cd "$REPO_DIR" && npm install --production

# Auto-capture ANTHROPIC_* env vars from current shell into .env
ENV_FILE="$REPO_DIR/.env"
CAPTURED=""
if env | grep -q "^ANTHROPIC_"; then
    echo "==> Detecting Claude Code credentials..."
    for var in $(env | grep "^ANTHROPIC_" | cut -d= -f1); do
        eval val=\$$var
        echo "$var=$val" >> "$ENV_FILE"
        CAPTURED="$CAPTURED $var"
    done
    echo "    Captured:$CAPTURED"
    echo "    Saved to $ENV_FILE"
else
    echo "==> No ANTHROPIC_* env vars detected in current shell."
    echo ""
    echo "    cc-proxy needs your Claude Code API credentials to work."
    echo "    Create $ENV_FILE with your credentials:"
    echo ""
    echo "      ANTHROPIC_BASE_URL=https://your-api-endpoint"
    echo "      ANTHROPIC_AUTH_TOKEN=your-token"
    echo ""
    echo "    Or re-run this installer from a terminal where Claude Code is active."
fi

echo "==> Configuring Hermes..."

if [ ! -f "$HERMES_CONFIG" ]; then
    echo "    Warning: Hermes config not found at $HERMES_CONFIG"
    echo "    Please configure your MCP client manually."
else
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
fi

echo ""
echo "Done! Restart Hermes to activate cc-proxy."
if [ -z "$CAPTURED" ]; then
    echo ""
    echo "⚠  Don't forget to create $ENV_FILE with your ANTHROPIC_* credentials."
fi
