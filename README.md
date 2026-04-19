# cc-proxy

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

MCP Server 桥接外部 Agent 与本地 Claude Code CLI 会话——用手机远程控制 Claude Code 编程。

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  手机 IM  │ ──▶ │  Hermes  │ ──▶ │ cc-proxy │ ──▶ │Claude CLI│ ──▶ │ Session  │
│ (微信/钉钉)│     │(MCP 客户端)│     │(MCP 服务端)│     │  (子进程) │     │(活跃会话) │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
```

## Quick Start

```bash
# 1. 一行安装
curl -fsSL https://raw.githubusercontent.com/cm8421/cc-proxy/main/install.sh | bash

# 2. 重启 Hermes
# 3. 在 Hermes 中使用 cc_list_projects 发现项目，cc_send_to_session 发送指令
```

前提：已安装 [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 和 [Hermes](https://github.com/nicepkg/hermes)。

## 功能

- 发现本机所有 Claude Code 项目和会话
- 向指定会话发送消息并获取响应
- 创建新的 Claude Code 会话
- 查询会话状态和摘要

## MCP 工具

| 工具 | 说明 | 只读 |
|------|------|------|
| `cc_list_projects` | 列出本机所有 Claude Code 项目 | Yes |
| `cc_list_sessions` | 列出会话，支持按项目过滤和分页 | Yes |
| `cc_send_to_session` | 向指定会话发送消息并获取响应 | No |
| `cc_create_session` | 为指定项目创建新会话 | No |
| `cc_get_session_status` | 检查会话进程是否存活 | Yes |
| `cc_get_session_summary` | 获取会话工作摘要和最近消息 | Yes |

## 快速安装

```bash
curl -fsSL https://raw.githubusercontent.com/cm8421/cc-proxy/main/install.sh | bash
```

一行命令完成克隆、依赖安装和 Hermes 配置，重启 Hermes 即可生效。

## 环境变量配置

cc-proxy 需要你的 Claude Code API 凭证来与 claude CLI 通信。

### 安装时自动配置（推荐）

一键安装脚本会自动检测当前终端中的 `ANTHROPIC_*` 环境变量并保存到 `.env` 文件：

```bash
# 确保在已激活 Claude Code 的终端中运行
curl -fsSL https://raw.githubusercontent.com/cm8421/cc-proxy/main/install.sh | bash
```

如果终端中已有 `ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN` 等变量，安装脚本会自动捕获，无需手动操作。

### 手动创建 `.env`

如果安装时未检测到凭证，在 cc-proxy 目录下手动创建 `.env`：

```bash
cat > ~/.cc-proxy/.env << 'EOF'
ANTHROPIC_BASE_URL=https://your-api-endpoint
ANTHROPIC_AUTH_TOKEN=your-token
EOF
```

### Hermes 配置传递

也可以在 Hermes 的 MCP 配置中通过 `env` 字段传递（此时不需要 `.env`）：

```yaml
mcp_servers:
  cc-proxy:
    command: ~/.cc-proxy/run.sh
    args:
      - --transport
      - stdio
    env:
      ANTHROPIC_BASE_URL: https://your-api-endpoint
      ANTHROPIC_AUTH_TOKEN: your-token
```

### 常见变量

| 变量 | 说明 | 必需 |
|------|------|------|
| `ANTHROPIC_BASE_URL` | API 端点地址 | 使用代理时 |
| `ANTHROPIC_AUTH_TOKEN` | API 认证令牌 | 使用代理时 |
| `ANTHROPIC_API_KEY` | Anthropic 官方 API Key | 使用官方 API 时 |
| `ANTHROPIC_MODEL` | 默认模型 | 可选 |

### 故障排查

**"Not logged in" 错误**：`.env` 文件缺失或凭证无效。运行 `cat ~/.cc-proxy/.env` 检查内容。

## 项目结构

```
src/
├── index.ts           # 入口，解析参数，启动 server
├── server.ts          # McpServer 注册 6 个 MCP 工具
├── claude-cli.ts      # Claude CLI 子进程管理 + stream-json 解析
├── session-store.ts   # 从 ~/.claude/sessions/ 发现会话
├── project-store.ts   # 从 ~/.claude/projects/ 发现项目
├── jsonl-reader.ts    # JSONL 会话历史解析
├── path-utils.ts      # 项目路径编解码
├── types.ts           # TypeScript 类型定义
└── config.ts          # 配置加载
```

## 依赖

- Node.js >= 18
- Claude Code CLI (`claude` 命令可用)

[English](README_EN.md)
