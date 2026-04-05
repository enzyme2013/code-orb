# Claude Code Tool System

## 目的

这份文档聚焦 Claude Code 的工具系统，回答三个问题：

1. Tool 抽象是怎么设计的
2. 工具是如何装配、调度和执行的
3. Claude Code 在工具系统上做了哪些重要优化

## 关键文件

- `src/Tool.ts`
- `src/tools.ts`
- `src/services/tools/toolOrchestration.ts`
- `src/services/tools/StreamingToolExecutor.ts`
- `src/services/tools/toolExecution.ts`
- 示例：
  - `src/tools/FileReadTool/FileReadTool.ts`
  - `src/tools/WebSearchTool/WebSearchTool.ts`

## 一、Tool 不只是一个函数

Claude Code 里的 `Tool` 是一个完整协议，不只是：

- 名字
- schema
- execute()

它同时包含：

- 输入 schema
- 输出 schema
- prompt
- description
- 权限逻辑
- 输入校验
- 并发属性
- 中断行为
- 结果持久化策略
- transcript / SDK 可见输入回填
- UI 渲染
- 搜索/发现元数据

定义见：

- `src/Tool.ts:362`

这个设计很重，但也很完整。它把“工具”从一个执行器提升成了 runtime 的一等对象。

## 二、Tool 抽象的关键字段

最重要的字段可以分成几类。

### 1. 执行相关

- `call()`
- `inputSchema`
- `outputSchema`
- `validateInput()`
- `checkPermissions()`

### 2. 编排相关

- `isConcurrencySafe()`
- `isReadOnly()`
- `isDestructive()`
- `interruptBehavior()`
- `maxResultSizeChars`

### 3. 发现与搜索相关

- `searchHint`
- `shouldDefer`
- `alwaysLoad`

### 4. 观察与策略相关

- `backfillObservableInput()`
- `preparePermissionMatcher()`
- `toAutoClassifierInput()`

### 5. UI 相关

- `renderToolUseMessage()`
- `renderToolResultMessage()`
- `renderToolUseProgressMessage()`
- `renderToolUseRejectedMessage()`
- `renderToolUseErrorMessage()`

这说明 Claude Code 的 tool 抽象同时服务于：

- model
- runtime
- permissions
- transcript
- UI
- telemetry

## 三、buildTool 的意义

所有工具都通过 `buildTool()` 构造。

关键位置：

- `src/Tool.ts:703`

它做的事情是：

- 给通用字段补默认值
- 保证所有工具导出后都有完整形状
- 让调用方不需要到处写 `?. ?? default`

默认值是很重要的设计信号：

- `isEnabled -> true`
- `isConcurrencySafe -> false`
- `isReadOnly -> false`
- `isDestructive -> false`
- `checkPermissions -> allow`
- `toAutoClassifierInput -> ''`
- `userFacingName -> tool.name`

这里有一个很明显的策略：

- 对“会影响安全或调度”的行为，默认保守
- 对“只是展示或便捷性”的行为，默认宽松

这对自研 runtime 很值得借鉴。

## 四、tools.ts 是总装配中心

`src/tools.ts` 是整个系统的工具注册中心。

关键位置：

- `src/tools.ts:193`

它做了三件事：

### 1. 统一列出所有工具

例如：

- `AgentTool`
- `SkillTool`
- `BashTool`
- `FileRead/Edit/Write`
- `Glob/Grep`
- `WebFetch/WebSearch`
- `Task*`
- `Team*`
- `WorkflowTool`

### 2. 按环境与 feature gate 过滤

很多工具只在特定环境启用：

- ant-only
- experimental feature
- LSP enabled
- worktree enabled
- todo v2 enabled

### 3. 提供工具预设

如：

- `default`

这让外部调用方可以：

- 直接拿完整工具集
- 按 preset 选取
- 再结合 permission / deny rule 过滤

## 五、工具执行调度

工具调度的核心在：

- `src/services/tools/toolOrchestration.ts`

最重要的逻辑是：

### 1. 先分批

`partitionToolCalls()` 会把当前 assistant 返回的多个 tool call 分成批次：

- 一个非并发安全工具，单独成批
- 连续的并发安全工具，可以放到同一批

关键位置：

- `src/services/tools/toolOrchestration.ts:91`

### 2. 并发安全工具并行执行

对于并发安全批次，使用 `runToolsConcurrently()` 并发跑。

### 3. 非并发安全工具串行执行

对于不可并发工具，走 `runToolsSerially()`。

### 4. 上下文修改延迟合并

并发执行时，tool 的 `contextModifier` 先排队，等这批完成后再按原始顺序应用。

这点很关键。

否则并发工具会互相污染 `ToolUseContext`。

## 六、StreamingToolExecutor

Claude Code 有一个很值得注意的优化：

- 工具不一定要等整条 assistant message 完成后才执行

如果 runtime gate 打开，会使用：

- `StreamingToolExecutor`

关键位置：

- `src/query.ts:561`
- `src/services/tools/StreamingToolExecutor.ts:34`

它的能力是：

- 一边接收 streaming 中途出现的 `tool_use`
- 一边决定能不能立刻开跑
- 维护执行队列和并发关系
- 保证结果最终仍按工具出现顺序输出

这比“整条 assistant 输出完再跑工具”更快。

### 它解决了什么问题

1. 降低 tool latency
2. 减少“模型等工具”的空转时间
3. 让长 streaming 回答里的早期工具更快启动

### 它额外处理了什么复杂性

- streaming fallback 时丢弃旧工具执行
- 用户中断时生成 synthetic tool_result
- 某个并行工具报错时取消兄弟工具
- 维护 interruptible state

## 七、工具系统上的几类优化

Claude Code 在 tool 上做了很多 runtime 级优化，最值得关注的是这些。

### 1. 并发属性优化

示例：

- `FileReadTool.isConcurrencySafe() -> true`
- `GrepTool.isConcurrencySafe() -> true`
- `WebSearchTool.isConcurrencySafe() -> true`

说明：

- 读类工具可以并发
- 写类工具通常不能并发

### 2. 读写属性优化

很多工具明确标注 `isReadOnly()`，让上层：

- 更容易决定权限
- 更容易分类 UI
- 更容易做 compact / summary / risk analysis

### 3. 结果大小控制

工具结果有 `maxResultSizeChars`。

这不是简单的显示优化，而是：

- 决定是否要落盘
- 决定是否只给模型 preview
- 决定 transcript 和 tool result storage 形态

`FileReadTool` 直接设置为 `Infinity`，因为把 Read 输出再持久化文件会形成循环读取问题。

### 4. 观察输入回填

`backfillObservableInput()` 用于：

- 给 transcript / SDK / hooks 看到的输入补派生字段
- 不修改真正发给模型的原始 tool input

这是一个非常实用的设计。

它解决了：

- prompt cache 稳定性
- hook 观测需要绝对路径
- transcript 可读性

### 5. 延迟加载 / ToolSearch

有些工具标记 `shouldDefer = true`，例如：

- `WebSearchTool`

这样工具不会一开始就完整暴露给模型，而是通过 ToolSearch 被“发现”后再真正进入可调用集合。

这对解决这些问题很重要：

- tool 太多
- prompt 太长
- MCP 工具数量动态增长

## 八、两个典型例子

### FileReadTool

关键特征：

- `maxResultSizeChars = Infinity`
- `strict = true`
- `isConcurrencySafe = true`
- `isReadOnly = true`
- `backfillObservableInput()`
- `preparePermissionMatcher()`
- `checkPermissions()`

这是一个典型的高频基础工具。

它不仅关心读文件，还关心：

- permissions
- transcript
- hook 兼容
- PDF / image / notebook 兼容
- token / size 限制

### WebSearchTool

关键特征：

- `shouldDefer = true`
- `isEnabled()` 会根据 provider / model 动态判断
- `isConcurrencySafe = true`
- `isReadOnly = true`

这是一个典型的“能力可见性”和“provider 能力差异”绑定的工具。

它展示了一个很重要的思想：

- tool 不只是 local runtime 的概念
- tool 还要感知 provider 能力边界

## 九、对 code-orb 的建议

最值得借鉴的是：

### 1. 把 tool 设计成 runtime 协议

不要只做：

- name
- schema
- execute

至少还要有：

- concurrency
- readOnly / destructive
- permissions
- result size strategy
- interrupt behavior

### 2. 统一通过 builder 构造

`buildTool()` 这种模式很适合 `code-orb`。

### 3. 尽早设计并发语义

不要等工具变多了再补。

从一开始就给每个工具定义：

- 是否可并发
- 是否只读
- 是否可中断

### 4. 尽早设计 deferred tool / ToolSearch

如果你未来要支持：

- 很多工具
- MCP
- plugin

就应该尽早为“延迟暴露工具”留出空间。

## 十、不建议直接照搬的部分

- UI 渲染接口塞进每个 Tool 的做法，对 library-first runtime 会偏重
- 过多 feature gate
- tool 与 telemetry 的强耦合
- 太产品化的 transcript / search text 细节

更适合 `code-orb` 的方式可能是：

- runtime core 保留纯执行协议
- UI 适配层单独做 renderer registry

## 十一、一句话总结

Claude Code 的工具系统不是“函数注册表”，而是一套同时服务于模型、权限、调度、持久化、UI 和 telemetry 的完整 runtime 协议。
