# Claude Agent SDK / Claude Code 讨论纪要

## 目的

这份文档记录我们当前对 `claude-agent-sdk` 和 `claude-code` 的理解，用于回答两个问题：

1. 这个 SDK 是给什么用户用的
2. 如果我们想做一个支持不同 LLM 的独立 agent 平台，它是否适合作为核心基础设施

## 1. Claude Agent SDK 是给谁用的

从包导出和运行方式来看，它面向的是“把 Claude Code 能力嵌入到自己产品或自动化系统中的开发者”，而不是普通 CLI 用户。

典型用户包括：

- IDE / 编辑器插件开发者
- 桌面开发工具开发者
- 内部自动化平台 / 工作流平台开发者
- 需要通过浏览器、WebSocket 或 bridge 接入 Claude Code 会话的产品团队

它的接口是程序化会话接口，而不是单纯的文本补全接口。调用方式更接近：

- 发起一个 query / session
- 流式接收消息
- 处理工具权限
- 注入 hooks / MCP / plugins / agents / skills
- 管理 session 历史、任务和子会话

## 2. 这个 SDK 具备哪些能力

从公开 API 看，它覆盖了 Claude Code 相当大一部分能力面：

- 会话与消息流
  - `query()`
  - `SDKSession`
  - `interrupt()`
  - `setModel()`
  - `setPermissionMode()`
  - `applyFlagSettings()`
- 内置工具能力
  - Bash
  - Read / Edit / Write
  - Glob / Grep
  - NotebookEdit
  - TodoWrite
  - WebFetch / WebSearch
  - Agent
  - MCP 相关工具
- 自定义扩展能力
  - 自定义 MCP server
  - hooks
  - plugins
  - custom agents
  - browser transport
  - bridge / remote session
- 历史与状态能力
  - `listSessions()`
  - `getSessionInfo()`
  - `getSessionMessages()`
  - `forkSession()`
  - `renameSession()`
  - `tagSession()`
  - `rewindFiles()`

因此，它不是一个薄封装，而是一个相当强的“Claude Code 编程接口层”。

## 3. 它依赖 Claude Code 吗

结论要分成两层：

### 3.1 是否依赖你额外安装一份 Claude Code

不一定。

SDK 默认会使用包内自带的 `cli.js`。也就是说，普通集成情况下，不一定需要用户在系统里单独安装一个全局 `claude-code`。

### 3.2 是否依赖 Claude Code runtime

依赖。

这点是关键。

它并不是一个从零实现的独立 agent runtime。它本质上是在驱动 Claude Code：

- 默认拉起包内的 `cli.js`
- 通过 Claude Code 的工具体系运行能力
- 使用 Claude Code 的 session / permission / tool / MCP / bridge 机制

所以更准确的表述是：

- 不一定依赖“额外安装的 Claude Code”
- 但一定依赖“Claude Code runtime 本身”

## 4. 这对我们的目标意味着什么

我们的目标是：

- 自己做一个 agent runtime
- 支持不同的 LLM provider
- 支持 agent / subagent / skill / tool / session / permission / MCP 等能力

在这个目标下，`claude-agent-sdk` 不适合作为核心底座，原因有三点：

### 4.1 它的中心仍然是 Claude Code

它的运行模型、能力组织方式、工具系统和桥接逻辑都围绕 Claude Code 构建。

如果把它作为底座，我们得到的将是：

- 一个“可编程的 Claude Code”
- 而不是一个“中立的多模型 agent runtime”

### 4.2 多模型支持会被放到错误的层级

我们真正需要的是一层独立的 `ModelAdapter`：

- OpenAI
- Anthropic
- Gemini
- 本地模型

都应该接到同一套 runtime 下。

如果底层直接建立在 Claude Code / Claude Agent SDK 之上，那么多模型支持会变成“在 Claude Code 外围打补丁”，长期会越来越别扭。

### 4.3 我们需要自己定义抽象边界

如果目标是平台化，最重要的不是先接模型，而是先定义清楚这些抽象：

- Tool
- Skill
- Agent
- Subagent
- Session
- Task
- Permission
- Memory
- MCP / Plugin

这些概念都应该由我们自己的 runtime 主导，而不是由某个现成 SDK 反向约束。

## 5. 更合理的定位

对我们来说，这个仓库和 SDK 更适合作为：

- 架构参考
- 模块拆分参考
- 产品能力参考
- 部分实现策略参考

尤其值得参考的模块包括：

- query / session 主循环
  - `src/QueryEngine.ts`
- 工具调度与并发安全
  - `src/services/tools/toolOrchestration.ts`
  - `src/services/tools/toolExecution.ts`
- skill 加载
  - `src/skills/loadSkillsDir.ts`
- agent 定义加载
  - `src/tools/AgentTool/loadAgentsDir.ts`
- in-process subagent / teammate 任务化
  - `src/utils/swarm/spawnInProcess.ts`
  - `src/tasks/InProcessTeammateTask/InProcessTeammateTask.tsx`

## 6. 当前最终判断

当前建议非常明确：

- 不要把 `claude-agent-sdk` 当作我们未来平台的核心 runtime
- 把它当作一份高价值参考实现来读
- 自己设计并实现 provider-agnostic 的 agent runtime

一句话总结：

`claude-agent-sdk` 适合“把 Claude Code 嵌进产品”，不适合“作为多模型独立 agent 平台的内核”。
