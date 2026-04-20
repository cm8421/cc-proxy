#!/bin/bash
set -e

INSTALL_DIR="$HOME/.cc-proxy"
HERMES_CONFIG="$HOME/.hermes/config.yaml"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Prerequisite checks ──
for cmd in node npm git; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Error: '$cmd' is required but not found in PATH." >&2
        echo "Please install $cmd first: https://nodejs.org/" >&2
        exit 1
    fi
done

NODE_VERSION=$(node -v 2>/dev/null)
echo "==> Prerequisites: node ${NODE_VERSION}, npm $(npm -v 2>/dev/null), git $(git --version 2>/dev/null | cut -d' ' -f3)"

# ── Source user's shell profile for nvm/fnm/volta paths ──
# When run via `curl | bash`, shell profiles are NOT loaded automatically.
_profile_sourced=false
for _rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile"; do
    if [ -f "$_rc" ]; then
        # Extract only PATH-modifying lines to avoid interactive side effects
        eval "$(grep -E '^(export )?PATH=|nvm|fnm|volta|\. ([^/]*/)*(nvm|fnm|volta)' "$_rc" 2>/dev/null || true)"
        _profile_sourced=true
    fi
done
if [ "$_profile_sourced" = false ]; then
    echo "    Warning: No shell profile found. PATH may be incomplete."
fi

# Clone if not already in repo
if [ ! -f "$REPO_DIR/src/index.ts" ]; then
    echo "==> Cloning cc-proxy..."
    rm -rf "$INSTALL_DIR"
    git clone https://github.com/cm8421/cc-proxy.git "$INSTALL_DIR"
    REPO_DIR="$INSTALL_DIR"
elif [ -d "$REPO_DIR/.git" ]; then
    echo "==> Upgrading cc-proxy..."
    cd "$REPO_DIR"
    OLD_VERSION=$(git describe --tags --always 2>/dev/null || git rev-parse --short HEAD)

    # Backup user configs, fresh clone, then restore — avoids all git merge issues
    _TMPDIR=$(mktemp -d)
    for _f in config.yaml .env .path; do
        [ -f "$_f" ] && cp "$_f" "$_TMPDIR/"
    done
    cd /tmp
    rm -rf "$REPO_DIR"
    git clone -q https://github.com/cm8421/cc-proxy.git "$INSTALL_DIR"
    REPO_DIR="$INSTALL_DIR"

    for _f in config.yaml .env .path; do
        [ -f "$_TMPDIR/$_f" ] && cp "$_TMPDIR/$_f" "$REPO_DIR/"
    done
    rm -rf "$_TMPDIR"

    NEW_VERSION=$(cd "$REPO_DIR" && git describe --tags --always 2>/dev/null || git rev-parse --short HEAD)
    echo "    Updated: $OLD_VERSION -> $NEW_VERSION"
fi

echo "==> Installing dependencies..."
cd "$REPO_DIR" && rm -rf node_modules && npm install --production && chmod +x run.sh

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
        cd "$REPO_DIR" && node -e "
const fs = require('fs');
const yaml = require('yaml');
const cfg = yaml.parse(fs.readFileSync('$HERMES_CONFIG', 'utf-8'));
if (!cfg.mcp_servers) cfg.mcp_servers = {};
cfg.mcp_servers['cc-proxy'] = {
    command: '$REPO_DIR/run.sh',
    args: ['--transport', 'stdio']
};
fs.writeFileSync('$HERMES_CONFIG', yaml.stringify(cfg));
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
