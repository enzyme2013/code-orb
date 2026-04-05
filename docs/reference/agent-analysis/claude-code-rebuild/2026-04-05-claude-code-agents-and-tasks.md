# Claude Code Agents, Subagents, And Tasks

## 目的

这份文档聚焦 Claude Code 的 agent / subagent / task runtime，回答这些问题：

1. subagent 是怎么运行的
2. 它是否复用主线程 query runtime
3. task 和 subagent 是什么关系
4. 对 `code-orb` 有哪些高价值借鉴

## 关键文件

- `src/tools/AgentTool/runAgent.ts`
- `src/utils/forkedAgent.ts`
- `src/utils/swarm/spawnInProcess.ts`
- `src/tasks/InProcessTeammateTask/InProcessTeammateTask.tsx`
- `src/Task.ts`
- `src/tasks/types.ts`

## 一、先区分三个概念

### 1. Agent

Agent 是角色定义。

它通常包含：

- system prompt
- tools
- mcp servers
- hooks
- model / effort
- permission mode
- maxTurns

### 2. Subagent

Subagent 是一次实际运行的 agent 实例。

它有：

- 自己的 agentId
- 自己的 messages
- 自己的 ToolUseContext
- 自己的 transcript sidechain
- 自己的 abort controller

### 3. Task

Task 是运行态管理对象。

它提供：

- task id
- status
- description
- output file
- kill
- UI 展示

Subagent 不一定总是可视化成 task，但需要被用户看见、控制、复盘的 subagent 往往会对应 task。

## 二、runAgent 是 subagent runtime 的核心

Claude Code 的 subagent 并没有一套完全独立的底层引擎。

它的核心入口是：

- `runAgent()`

关键位置：

- `src/tools/AgentTool/runAgent.ts`

最关键的一点是：

- `runAgent()` 最终还是调用同一个 `query()`

位置：

- `src/tools/AgentTool/runAgent.ts:748`

这意味着：

- 主线程和 subagent 共享同一套 query runtime
- 差别主要在于 `ToolUseContext`、初始消息、agent 配置和状态隔离方式

这是非常值得借鉴的设计。

## 三、createSubagentContext 的意义

真正把“主线程 agent”和“subagent”分开的，不是另一个 query loop，而是：

- `createSubagentContext()`

关键位置：

- `src/utils/forkedAgent.ts:345`

它默认做的是：

- 克隆 `readFileState`
- 创建新的 abortController
- 包装 `getAppState()`，默认避免 permission prompt UI
- 默认把 `setAppState` 变成 no-op
- 创建新的 `queryTracking`
- 使用新的 `agentId`
- 建立新的本地 denial tracking

这说明 Claude Code 的 subagent 隔离策略是：

- 底层 loop 复用
- 运行上下文隔离

## 四、subagent 默认如何隔离

默认情况下，subagent 是“强隔离”的。

主要体现在：

### 1. 状态写入隔离

- `setAppState` 默认不共享

### 2. abort 隔离

- 默认不是共用父 agent 的 abortController
- 而是 child abort controller

### 3. file cache 隔离

- `readFileState` 默认克隆

### 4. query tracking 隔离

- 新的 `chainId`
- 深度 `depth + 1`

### 5. contentReplacementState 默认克隆

这是一个非常细的设计点。

它的目的不是 UI，而是：

- 保持 prompt cache 兼容
- 确保父子 agent 对同一 tool result replacement 做出一致决定

## 五、什么时候共享父上下文

`createSubagentContext()` 也支持显式共享。

例如：

- `shareSetAppState`
- `shareSetResponseLength`
- `shareAbortController`

这意味着 Claude Code 不把 subagent 简单分成“同步/异步”两类，而是：

- 根据交互需求选择性共享能力

这对复杂 agent runtime 很重要。

## 六、runAgent 的主要流程

`runAgent()` 的关键步骤大致是：

1. 解析 agent 定义
2. 初始化 agent-specific MCP servers
3. 创建 subagent `ToolUseContext`
4. 写 sidechain transcript 初始消息
5. 写 agent metadata
6. 调 `query()`
7. 流式记录消息
8. 收尾清理 MCP / hooks / shell tasks / telemetry

其中很关键的一点是：

- subagent 的 transcript 不直接混进主 transcript
- 而是写入 sidechain transcript

这使得：

- resume
- trace
- teammate view
- background task inspection

都变得可行。

## 七、Task 抽象

Task 抽象在：

- `src/Task.ts`

它定义了：

- `TaskType`
- `TaskStatus`
- `TaskStateBase`
- `Task`

关键位置：

- `src/Task.ts:1`

已有 task 类型包括：

- `local_bash`
- `local_agent`
- `remote_agent`
- `in_process_teammate`
- `local_workflow`
- `monitor_mcp`
- `dream`

这说明 Claude Code 的 task 体系并不是只为 subagent 服务，而是一个更广义的后台运行单元框架。

## 八、TaskState 联合类型

Task 实际运行态统一放在：

- `src/tasks/types.ts`

这里把多种 task state 合成一个联合：

- LocalShellTaskState
- LocalAgentTaskState
- RemoteAgentTaskState
- InProcessTeammateTaskState
- LocalWorkflowTaskState
- MonitorMcpTaskState
- DreamTaskState

这说明 task 层的目标是：

- 给 UI 和调度层一个统一可观察接口

## 九、in-process teammate

Claude Code 的一个很有意思的能力是：

- in-process teammate

相关文件：

- `src/utils/swarm/spawnInProcess.ts`
- `src/tasks/InProcessTeammateTask/InProcessTeammateTask.tsx`

这里做的事情不是“另起一个进程”，而是：

- 在同一个 Node 进程里创建独立 teammate context
- 注册 task
- 使用 AsyncLocalStorage / agent identity 进行逻辑隔离

这种做法的好处是：

- 启动快
- UI 集成紧
- 共享很多宿主能力

代价是：

- runtime 隔离更弱
- 状态和取消管理要更严谨

## 十、为什么 sidechain transcript 很重要

subagent 最容易被低估的不是 query loop，而是 transcript。

Claude Code 很明确地把 subagent 历史写到 sidechain：

- 初始消息会写
- 每条 recordable message 会继续写

这带来几个非常重要的能力：

- 后台 agent 可以恢复
- teammate transcript 可以查看
- resume 可以定位到正确 agent type
- 诊断和调试更容易

如果没有 sidechain transcript，subagent 很容易变成不可恢复的黑盒。

## 十一、主线程和 subagent 的关系

最重要的关系可以总结成：

### 相同点

- 都用 `query()`
- 都用同一套 tools
- 都用同一套模型调用层
- 都用同一套 message 类型

### 不同点

- system prompt 不同
- ToolUseContext 不同
- transcript 路径不同
- 是否共享 UI/state callback 不同
- abort / permission prompt 能力不同

也就是说，Claude Code 的设计不是：

- 为 subagent 再造一套系统

而是：

- 在统一 runtime 上做上下文分叉

## 十二、对 code-orb 的建议

最值得借鉴的是这些。

### 1. 子代理不要单独实现另一套 loop

最好做成：

- 同一个 query runtime
- 不同的 context / session / policy

### 2. subagent 要有显式上下文工厂

`createSubagentContext()` 这种工厂非常关键。

这样你可以清楚定义：

- 哪些状态继承
- 哪些状态克隆
- 哪些 callback 共享
- 哪些 callback 禁止

### 3. task 和 subagent 解耦但可关联

不是所有 subagent 都必须显示成 task。

但凡你希望：

- 可取消
- 可观察
- 可恢复
- 可回放

就应该把它和 task 系统挂起来。

### 4. sidechain transcript 非常值得借鉴

如果 `code-orb` 未来要支持：

- background agent
- teammate
- resumable task
- post-mortem replay

那么 subagent transcript 侧链几乎是必需的。

## 十三、不建议直接照搬的部分

- 过重的任务类型体系
- 和 TUI/UI 过强耦合的 task 呈现逻辑
- 太复杂的 ant-only / feature-gated teammate 模式

对 `code-orb` 更合理的策略是：

- 先做统一 subagent runtime
- 再做最小 task abstraction
- 最后再做复杂 teammate / background task UI

## 十四、一句话总结

Claude Code 的 subagent 设计核心不是“另一套 agent engine”，而是“在同一 query runtime 上，通过独立的 ToolUseContext、agentId、transcript 和 task 管理形成可恢复、可观察、可调度的子代理执行单元”。
