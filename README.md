# cc-proxy

MCP Server 桥接 Hermes Agent 与本地 Claude Code CLI 会话。

```
手机 IM → Hermes Agent (MCP Client) → cc-proxy (MCP Server) → Claude CLI → Claude Code Session
```

## 功能

- 发现本机所有 Claude Code 项目和会话
- 向指定会话发送消息并获取响应
- 创建新的 Claude Code 会话
- 查询会话状态和摘要

## MCP 工具

| 工具 | 说明 |
|------|------|
| `list_projects` | 列出本机所有 Claude Code 项目 |
| `list_sessions` | 列出会话，可按项目路径过滤 |
| `send_to_session` | 向指定会话发送消息并获取响应 |
| `create_session` | 为指定项目创建新会话 |
| `get_session_status` | 检查会话进程是否存活 |
| `get_session_summary` | 获取会话工作摘要 |

## 安装

```bash
cd cc-proxy
pip install -e .
```

## 使用

### stdio 模式（Hermes 集成）

```bash
python -m cc_proxy.server --transport stdio
```

或使用启动脚本：

```bash
./run.sh
```

### HTTP 模式

```bash
python -m cc_proxy.server --transport streamable-http --host 127.0.0.1 --port 8765
```

## Hermes 配置

在 `~/.hermes/config.yaml` 中添加：

```yaml
mcp_servers:
  cc-proxy:
    command: /path/to/cc-proxy/run.sh
    args:
      - --transport
      - stdio
```

## 项目结构

```
src/cc_proxy/
├── server.py          # FastMCP 入口，注册 MCP 工具
├── claude_cli.py      # Claude CLI 子进程管理 + stream-json 解析
├── session_store.py   # 从 ~/.claude/sessions/ 发现会话
├── project_store.py   # 从 ~/.claude/projects/ 发现项目
├── jsonl_reader.py    # JSONL 会话历史解析
├── path_utils.py      # 项目路径编解码
├── models.py          # Pydantic 数据模型
└── config.py          # 配置加载
```

## 依赖

- Python >= 3.11
- fastmcp >= 2.0
- pydantic >= 2.0
- pyyaml >= 6.0
- Claude Code CLI (`claude` 命令可用)
