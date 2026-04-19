# Contributing to cc-proxy

## Development Setup

```bash
git clone https://github.com/cm8421/cc-proxy.git
cd cc-proxy
npm install
```

## Development

```bash
# Run in dev mode (auto-reload)
npm run dev

# Type check
npx tsc --noEmit

# Build
npm run build
```

## Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector tsx src/index.ts --transport stdio
```

## Submitting Changes

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit with conventional commits: `feat:`, `fix:`, `docs:`, etc.
4. Push and open a Pull Request

## Reporting Issues

Open a [GitHub Issue](https://github.com/cm8421/cc-proxy/issues) with:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version, OS, Claude Code CLI version
