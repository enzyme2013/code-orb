# Claude Code Query Engine And Loop

## 目的

这份文档聚焦 Claude Code 的 query runtime，回答两个问题：

1. 一次用户输入是如何变成完整 agent 执行流程的
2. 主循环为什么不是普通的 chat loop，而是一个 agentic orchestration loop

## 关键文件

- `src/QueryEngine.ts`
- `src/query.ts`
- `src/query/config.ts`
- `src/query/deps.ts`
- `src/services/api/claude.ts`
- `src/utils/processUserInput/processUserInput.ts`

## 一、核心分层

Claude Code 在 query 相关的实现上，至少拆成了三层：

### 1. 输入处理层

负责把“用户输入”转成真正要进入模型的消息。

入口：

- `processUserInput()` in `src/utils/processUserInput/processUserInput.ts`

它会处理：

- slash command
- 附件
- 图片
- hook
- 桥接消息
- 一些特殊 keyword 路由

结果不一定会进入模型。

很多本地命令在这里就结束了：

- 只生成本地结果消息
- `shouldQuery = false`

### 2. 会话层

负责维护一整个 conversation 的运行状态。

入口：

- `QueryEngine` in `src/QueryEngine.ts`

它维护：

- `mutableMessages`
- `readFileState`
- `permissionDenials`
- `totalUsage`
- `discoveredSkillNames`

它不是“一次 API 调用”的封装，而是“一段会话”的封装。

### 3. 单次 turn 主循环层

负责执行一次真正的 agentic query。

入口：

- `query()`
- `queryLoop()`

这个循环做的是：

- 压缩上下文
- 调模型
- 接收 tool use
- 执行工具
- 拼接 tool result
- 判断是否继续下一轮

## 二、一次完整 query 的流程

以 `QueryEngine.submitMessage()` 为起点，一次输入的主路径是：

1. 读取当前配置与会话状态
2. 构造 `ToolUseContext`
3. 计算 system prompt / user context / system context
4. 调用 `processUserInput()`
5. 若 `shouldQuery = false`，直接返回本地结果
6. 若 `shouldQuery = true`，进入 `query()`
7. `query()` 内部运行 `queryLoop()`
8. `queryLoop()` 可能多次调用模型
9. 最终由 `QueryEngine` 汇总流式结果和 usage，产出最终 `result`

### 关键代码位置

- `QueryEngine.submitMessage()`
  - `src/QueryEngine.ts:209`
- `processUserInput()`
  - `src/QueryEngine.ts:410`
  - `src/utils/processUserInput/processUserInput.ts:85`
- 调 `query()`
  - `src/QueryEngine.ts:675`

## 三、一次用户输入是否只调用一次 LLM

不是。

这是理解 Claude Code runtime 的最关键点之一。

### 1. 会话层多轮

同一个 `QueryEngine` 可以多次 `submitMessage()`。

这对应普通意义上的 conversation 多轮。

### 2. 单次 turn 内部多轮

即使用户只输入一次，`queryLoop()` 也可能对模型进行多次请求。

最常见的原因是：

- 模型返回 `tool_use`
- 工具执行后产出 `tool_result`
- 新的 `messages` 被拼回上下文
- 再次调用模型继续推理

因此单次用户输入的真实结构更像：

```text
user input
-> model
-> tool_use
-> tool_result
-> model
-> tool_use
-> tool_result
-> model
-> final answer
```

这就是 Claude Code 的“agentic”本质。

## 四、queryLoop 的职责

`queryLoop()` 是整个运行时的核心循环。

入口：

- `src/query.ts:241`

核心状态：

- `messages`
- `toolUseContext`
- `turnCount`
- `maxOutputTokensRecoveryCount`
- `hasAttemptedReactiveCompact`
- `pendingToolUseSummary`
- `transition`

### 每轮循环做什么

#### 1. 准备上下文

包括：

- `applyToolResultBudget`
- `snip`
- `microcompact`
- `context collapse`
- `autocompact`

这些都发生在真正调用模型之前。

这说明 Claude Code 的主循环不是“纯模型驱动”，而是一个带有大量 pre-processing 的 orchestrator。

#### 2. 调模型

通过 `deps.callModel()` 进入 `queryModelWithStreaming()`。

关键点：

- 支持 streaming
- 支持 fallback model
- 支持 tool search / deferred tools
- 支持 budget / advisor / query tracking

#### 3. 收集 assistant 输出

循环里会积累：

- `assistantMessages`
- `toolUseBlocks`
- `toolResults`

只要出现 `tool_use`，就会标记 `needsFollowUp = true`。

#### 4. 执行工具

如果有 `toolUseBlocks`，则进入工具执行阶段：

- streaming executor 或普通 `runTools`
- 执行完成后追加 attachment / memory / queue message / skill discovery
- 刷新工具集
- 生成下一轮状态

#### 5. 判断终止还是继续

如果没有 follow-up，loop 进入结束逻辑。

如果有 follow-up，则把：

- `messagesForQuery`
- `assistantMessages`
- `toolResults`

合并为下一轮 `state.messages`，然后 `continue`。

## 五、这不是普通 chat loop

Claude Code 的 loop 与常见 chat loop 的根本差异在于，它的“继续条件”非常多：

- `tool_use`
- `stop hook` 阻断重试
- `token budget continuation`
- `prompt-too-long` 恢复
- `reactive compact`
- `max_output_tokens` 恢复
- fallback retry

这意味着它更像：

- 一个状态机
- 一个编排器
- 一个 query reducer 的演化实现

而不是简单的：

- 发请求
- 收回答
- 结束

## 六、为什么有 QueryEngine 和 query() 两层

这是个很值得借鉴的拆分。

### QueryEngine 负责

- conversation 生命周期
- 持久 state
- transcript 记录
- usage 聚合
- SDK 输出适配

### query() / queryLoop() 负责

- 单次 turn 内部的 agentic runtime
- 模型与工具的多轮编排
- 恢复机制

这使得：

- 会话状态和单次 loop 状态分离
- 未来可以更容易把 `queryLoop()` 提取成可测试 reducer
- SDK/REPL/headless 都能复用同一套底层 loop

## 七、对 code-orb 的建议

最值得借鉴的是这几个点：

### 1. 会话对象和单次 query loop 分离

不要把“conversation state”和“本轮 agent 执行”写进同一个大函数。

### 2. 把 loop 当作 orchestration loop 设计

从第一天开始就考虑：

- tool use
- retry
- compact
- budget
- subagent

不要先做成单轮 chat，再慢慢补丁式加工具。

### 3. 输入处理层独立

`processUserInput()` 这种层非常重要。

它把：

- slash command
- attachment
- image
- bridge message
- user caveat

挡在模型调用前面，极大降低了 loop 的复杂度。

### 4. 明确区分“turn 内多轮”和“会话多轮”

这能避免 runtime 设计时把“用户轮次”和“模型/API 轮次”混淆。

## 八、不建议直接照搬的部分

对 `code-orb` 来说，不建议一开始就复制这些：

- 复杂的 compact / snip / context-collapse 三套并存
- 太多 feature gate
- 与 UI、高级 telemetry 强耦合的行为
- 太多产品特化的恢复分支

更合理的做法是：

先把最小 loop 做出来，再逐层加入：

- tool use
- retry
- budget
- compact
- subagent

## 九、一句话总结

Claude Code 的 query runtime 本质上是：

一个以 `QueryEngine` 为会话壳、以 `queryLoop()` 为核心状态机、围绕模型调用和工具执行不断迭代直到稳定终态的 agentic loop。
