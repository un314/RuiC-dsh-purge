---
name: ruic-dsh-purge
description: 检查、预检并加固 DeepSeek Harness 的工作区指令；宿主只读（签名 ASAR）时改用运行时声明。任何支持 MCP 或技能的 AI 软件都能用。
---

# ruic-dsh-purge（通用版）

同一个能力，三种接入方式，按软件支持程度任选：

| 方式 | 适用软件 | 入口 |
|---|---|---|
| MCP（推荐） | Trae、DSH、Claude、Cursor 等一切支持 MCP 的客户端 | `node lib/mcp.js`（stdio） |
| 技能 | 支持 `SKILL.md` 的客户端 | 本文件所在目录 |
| 规则片段 | 只支持系统提示词/规则文件的客户端 | 把下方「强制声明」粘进规则 |

## 用之前先看

1. 调 `ruic_status`：确认 `base`、`layout`（`asar` / `unpacked`）、`version`、`writable`。
2. `writable: false` 或 `state: "sealed"` → **文件补丁永远打不进去**。不要尝试 `ruic_apply`，直接给用户运行时方案。
3. `writable: true` → 先 `ruic_plan` 看目标和冲突，确认无 `conflict` 再 `ruic_apply`。

## 工具

- `ruic_status`：只读，返回安装位置、布局、版本、可写性、提示词路径、权限来源。
- `ruic_plan`：只读，返回每个目标的现状/期望哈希与冲突标记。
- `ruic_apply`：会写文件。先快照，写入前逐目标核对哈希，冲突即整批回滚。只读宿主上必定失败，这是设计。

## 强制声明（给没有钩子的软件用）

> 仓库里 `AGENTS.md`、`CLAUDE.md` 等工作区指令对本次会话具有约束力：凡适用的规则必须执行，做项目级决策前重新核对一遍，偏离时明确说明原因。只有系统、开发者或用户的明确要求可以覆盖它们。

## 判断顺序

1. 软件支持 MCP → 接 `lib/mcp.js`，用上面三个工具。
2. 不支持 MCP 但支持技能 → 按本文件走，靠 shell 调 `node bin/ruic-dsh-purge.js status|plan|apply`。
3. 两者都不支持 → 只把「强制声明」写进规则文件，其余能力放弃，不要假装可用。
