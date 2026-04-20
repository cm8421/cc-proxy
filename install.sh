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
elif [ -d "$REPO_DIR/.git" ]; then
    echo "==> Upgrading cc-proxy..."
    # Stash local config changes, pull, then restore
    cd "$REPO_DIR"
    OLD_VERSION=$(git describe --tags --always 2>/dev/null || git rev-parse --short HEAD)
    git stash -q 2>/dev/null || true
    git pull -q origin main 2>/dev/null || true
    git stash pop -q 2>/dev/null || true
    NEW_VERSION=$(git describe --tags --always 2>/dev/null || git rev-parse --short HEAD)
    if [ "$OLD_VERSION" = "$NEW_VERSION" ]; then
        echo "    Already up to date ($NEW_VERSION)"
    else
        echo "    Updated: $OLD_VERSION -> $NEW_VERSION"
    fi
fi

echo "==> Installing dependencies..."
cd "$REPO_DIR" && rm -rf node_modules && npm install --production

# Save current PATH for run.sh (so MCP client can find node/npx/claude)
echo "$PATH" > "$REPO_DIR/.path"

# Detect Claude CLI full path
echo "==> Detecting Claude CLI..."
CLAUDE_PATH=$(command -v claude 2>/dev/null || true)
if [ -n "$CLAUDE_PATH" ]; then
    echo "    Found: $CLAUDE_PATH"

    CONFIG_FILE="$REPO_DIR/config.yaml"
    if [ -f "$CONFIG_FILE" ]; then
        # Update existing config: replace cli_path or claude_cli_path
        if grep -q "cli_path:" "$CONFIG_FILE"; then
            sed -i.bak "s|cli_path:.*|cli_path: \"$CLAUDE_PATH\"|" "$CONFIG_FILE"
        elif grep -q "claude_cli_path:" "$CONFIG_FILE"; then
            sed -i.bak "s|claude_cli_path:.*|cli_path: \"$CLAUDE_PATH\"|" "$CONFIG_FILE"
        fi
        rm -f "$CONFIG_FILE.bak"
    else
        cat > "$CONFIG_FILE" << 'YAML'
server:
  host: "127.0.0.1"
  port: 8765

claude:
  cli_path: "PLACEHOLDER"
  home: "~/.claude"

session:
  max_stream_timeout: 1800
  summary_max_messages: 5
  summary_max_chars: 200
YAML
        sed -i.bak "s|PLACEHOLDER|$CLAUDE_PATH|" "$CONFIG_FILE"
        rm -f "$CONFIG_FILE.bak"
    fi
    echo "    Saved to $CONFIG_FILE"
else
    echo "    Warning: 'claude' not found in PATH."
    echo "    Default 'claude' will be used. If you get ENOENT errors,"
    echo "    edit $REPO_DIR/config.yaml and set claude_cli_path to the full path."
fi

# Auto-capture ANTHROPIC_* env vars from current shell into .env
ENV_FILE="$REPO_DIR/.env"
CAPTURED=""
if env | grep -q "^ANTHROPIC_"; then
    echo "==> Detecting Claude Code credentials..."
    # Rewrite .env from scratch to avoid duplicates on upgrade
    > "$ENV_FILE"
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
