# 独立 Agent Runtime 架构草案

## 目标

设计并实现一个独立于 Claude Code 的 agent runtime，满足这些能力：

- 连接不同 LLM provider
- 支持 agent / subagent / skill / tool
- 支持流式会话与任务状态
- 支持权限控制与工具执行
- 支持 MCP / plugin 风格扩展
- 能作为 CLI、桌面应用、服务端 worker、IDE 插件的共同底层

## 非目标

当前阶段不追求：

- 完整复刻 Claude Code 的全部 UI
- 复刻它所有内部策略和隐藏能力
- 一开始就支持远端 bridge、浏览器端、多人协作、复杂 telemetry

先把 runtime 核心做对，再考虑外层产品化。

## 核心判断

如果目标是多模型独立平台，应该采用：

- 自有 runtime
- provider adapter
- 声明式 agent / skill / tool 配置
- 独立的 subagent 任务模型

不应该采用：

- 以 `claude-agent-sdk` 为核心
- 再在外围“补”多模型能力

## 一、核心领域模型

### 1. Tool

Tool 是“可执行能力”。

例如：

- 文件读取
- 文件编辑
- 终端命令执行
- 代码搜索
- HTTP 请求
- Web 搜索
- MCP tool 调用

它应该包含：

- 名称
- 描述
- 输入 schema
- 输出 schema
- 权限要求
- 执行器
- 是否支持并发
- 超时 / 重试 / 取消策略

### 2. Skill

Skill 是“提示资产”或“工作说明书”。

Skill 不直接执行系统能力，它更像：

- 一段被按需注入的操作规范
- 一套工作流提示词
- 一个约束 agent 行为的说明文档

推荐形式：

- `markdown + frontmatter`

frontmatter 里可以定义：

- 名称
- 描述
- when_to_use
- allowed_tools
- model override
- effort
- 参数占位

### 3. Agent

Agent 是一个“角色配置”。

它定义：

- system prompt
- 默认模型
- 可用 tools
- 禁用 tools
- 预加载 skills
- permission mode
- effort / budget
- 是否支持后台运行

Agent 不是单次会话；它更像某种角色模板。

### 4. Subagent

Subagent 是一个独立任务单元。

它应该具备：

- 自己的会话上下文
- 自己的消息流
- 自己的 token / cost / 时间预算
- 独立取消信号
- 可被主 agent 调度
- 可返回结构化结果或任务产物

Subagent 不能只是主 agent 里的普通函数调用。它必须是可观测、可取消、可调度的任务。

### 5. Session

Session 是一段持续会话。

负责：

- 消息历史
- context assembly
- tool result 回写
- transcript 持久化
- budget / usage 统计
- rewind / replay / fork

### 6. Task

Task 是运行态对象。

用来表达：

- 一个 agent 当前在做什么
- 状态是 running / idle / waiting / completed / failed / stopped
- 中间产物是什么
- 是否可取消

## 二、建议的模块分层

推荐拆成 7 层。

### 1. ModelAdapter

职责：

- 统一不同 LLM provider 的调用方式
- 屏蔽各家差异

统一接口至少应包含：

```ts
export type ModelAdapter = {
  name: string
  supportsTools: boolean
  supportsParallelToolCalls: boolean
  supportsStructuredOutput: boolean
  supportsVision: boolean
  invoke(input: ModelInvokeInput): Promise<ModelInvokeResult>
  stream(input: ModelInvokeInput): AsyncGenerator<ModelStreamEvent>
}
```

关键点：

- 不要把 OpenAI / Anthropic 原始 message schema 暴露到业务层
- 业务层只能看到统一的 `ModelInvokeInput`
- tool call / partial token / structured output 都要统一抽象

### 2. QueryEngine

职责：

- 组织一次 turn 的执行
- 组装 system prompt / memory / skills / tools context
- 调用模型
- 接管 tool call
- 汇总结果并生成 transcript

这层是 runtime 的核心心脏。

推荐参考：

- `src/QueryEngine.ts`

但实现上应与某个模型供应商解耦。

### 3. ToolRuntime

职责：

- 工具注册
- schema 校验
- 权限判断
- 执行调度
- 并发控制
- 取消 / 超时 / 重试
- 结果回写

关键设计：

- 区分并发安全工具和非并发安全工具
- 读类工具可以并发
- 改写类工具通常串行

推荐参考：

- `src/services/tools/toolOrchestration.ts`
- `src/services/tools/toolExecution.ts`

### 4. SkillRegistry

职责：

- 加载 skills
- 前置解析 frontmatter
- 按名称或语义查找 skill
- 根据上下文决定是否注入 skill

推荐形式：

- 本地目录加载
- markdown frontmatter

推荐参考：

- `src/skills/loadSkillsDir.ts`

### 5. AgentRegistry

职责：

- 加载 agent 定义
- 合并内置 / 用户 / 项目 / 插件级 agent
- 给 QueryEngine 提供 agent 配置

推荐参考：

- `src/tools/AgentTool/loadAgentsDir.ts`

### 6. SubagentRuntime

职责：

- 创建 subagent
- 维护子任务生命周期
- 提供消息流和状态
- 允许主 agent 拉起、等待、取消、收集结果

推荐参考：

- `src/utils/swarm/spawnInProcess.ts`
- `src/tasks/InProcessTeammateTask/InProcessTeammateTask.tsx`

### 7. Extension Layer

职责：

- MCP
- plugin
- 自定义工具包
- 外部服务集成

这个层要晚于 runtime 核心落地。

## 三、推荐的执行流

一次主 agent turn 的建议执行流程：

1. 收到用户输入
2. 载入 agent 配置
3. 解析需要的 skills
4. 组装上下文
5. 调用 `ModelAdapter`
6. 如果模型返回 tool calls，则进入 `ToolRuntime`
7. 工具结果回写到 session
8. 若有 subagent 请求，则进入 `SubagentRuntime`
9. 继续下一轮，直到得到最终结果或达到预算限制
10. 记录 transcript、usage、cost、状态变化

## 四、权限与安全建议

权限系统必须独立设计，不要塞进工具里硬编码。

建议抽象：

```ts
export type PermissionMode =
  | "default"
  | "accept_edits"
  | "plan"
  | "dont_ask"
  | "bypass"
```

建议能力：

- tool 级 allow / deny
- 路径级 allow / deny
- 网络域名 allow / deny
- 会话级临时授权
- 用户级持久授权
- hooks / policy 强制覆盖

如果将来需要沙箱：

- 文件系统沙箱
- 网络沙箱
- 命令执行白名单

都应放到 runtime 的权限层，而不是模型层。

## 五、推荐的数据与配置格式

### 1. Skill

建议：

```md
---
name: code-review
description: Review code for correctness and regression risk
when_to_use: Use when the user asks for review or bug finding
allowed_tools:
  - Read
  - Grep
  - Glob
model: inherit
effort: high
---

...
```

### 2. Agent

建议：

```json
{
  "code-reviewer": {
    "description": "Review code for correctness and regressions",
    "prompt": "You are a strict code reviewer...",
    "tools": ["Read", "Grep", "Glob"],
    "skills": ["code-review"],
    "model": "sonnet",
    "permissionMode": "plan",
    "maxTurns": 8
  }
}
```

### 3. Tool

建议以代码注册：

```ts
registerTool({
  name: "Read",
  description: "Read file content",
  inputSchema: z.object({ path: z.string() }),
  outputSchema: z.object({ content: z.string() }),
  isConcurrencySafe: true,
  execute: async input => { ... }
})
```

## 六、最小可行版本建议

不要一开始就追求完整平台，先做一个 MVP。

### MVP 第一阶段

- 单 session 主循环
- 单 provider adapter
- 8 到 10 个核心工具
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - WebFetch
  - TodoWrite
- skill 加载
- agent 定义加载
- transcript 持久化

### 第二阶段

- 第二个 model provider
- structured output
- budget / token / cost tracking
- permission system
- hooks

### 第三阶段

- subagent runtime
- task 管理
- 背景 agent
- MCP 接入

### 第四阶段

- plugin 系统
- 远端运行
- 浏览器 / IDE / 服务端统一接入层

## 七、关键设计原则

### 1. 先统一模型接口，再接第二家模型

否则多模型支持很快会退化成 provider-specific 分支地狱。

### 2. Skill 和 Tool 必须分开

- Skill 是提示资产
- Tool 是执行能力

不要混用。

### 3. Subagent 必须任务化

subagent 必须有：

- 状态
- 预算
- 取消能力
- 输出流

不要只做成一个“递归调用主 agent”的函数。

### 4. Agent 配置要声明式

不要把不同 agent 的 system prompt 和策略散落在代码里硬编码。

### 5. 权限系统要独立

权限、工具、模型三者不要耦死。

## 八、与 Claude Code 路线的关系

最合理的策略是：

- 学它的模块拆分
- 学它的执行流
- 学它的工具和 subagent 组织方式
- 但不要直接把它当作底层 runtime

我们应该得到的是：

- 一个独立 runtime
- 可以接 OpenAI / Anthropic / Gemini / 本地模型
- 可以表达自己的 agent / skill / tool / subagent / permission 体系

## 九、当前推荐结论

如果我们要做自己的 agent 平台，推荐路径是：

1. 把本仓库当参考实现
2. 自建 provider-agnostic runtime
3. 先落地最小主循环和工具系统
4. 再增加 skill / agent / subagent / MCP / plugin

一句话总结：

先做自己的 runtime，再把 Claude Code 的好设计吸收进来；不要反过来。
