# Changelog

## v0.2.0 (2025-04-19)

### Added
- Zero-config auth: auto-capture `ANTHROPIC_*` env vars during install
- Modern MCP tool registration with `registerTool()` API
- Tool annotations (`readOnlyHint`, `destructiveHint`, etc.)
- Pagination support for `cc_list_sessions` (`limit`/`offset`)
- Session ID extraction from `create_session` response
- Install directory changed to `~/.cc-proxy`

### Changed
- Rewritten from Python to Node.js/TypeScript
- Replaced async generator with Promise-based stream collection
- Timeout increased to 30 minutes (configurable)

## v0.1.0 (2025-04-18)

### Added
- Initial Python implementation
- 6 MCP tools: `cc_list_projects`, `cc_list_sessions`, `cc_send_to_session`, `cc_create_session`, `cc_get_session_status`, `cc_get_session_summary`
- One-line install script
- Bilingual README (CN/EN)
- Apache 2.0 License
