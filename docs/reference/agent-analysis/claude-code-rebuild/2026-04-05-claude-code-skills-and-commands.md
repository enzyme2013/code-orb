# Claude Code Skills And Commands

## 目的

这份文档聚焦 Claude Code 的 skill / command 体系，回答四个问题：

1. skill 在 Claude Code 里到底是什么
2. 它们从哪里加载
3. 用户手动 `/skill` 和模型通过 `SkillTool` 调用 skill 有什么区别
4. 什么情况下 skill 会 inline，什么情况下会 fork 到 subagent

## 关键文件

- `src/skills/loadSkillsDir.ts`
- `src/commands.ts`
- `src/tools/SkillTool/SkillTool.ts`
- `src/utils/processUserInput/processSlashCommand.tsx`
- `src/tools/AgentTool/runAgent.ts`

## 一、先下定义

在 Claude Code 里，skill 不是一个独立运行时。

它更准确的定义是：

- 一种 `prompt command`
- 一份 markdown 形式的提示资产
- 带 frontmatter 元数据
- 可以被用户 `/skill` 调用，也可以被模型通过 `SkillTool` 调用

也就是说：

- skill 的底层单位仍然是 `Command`
- 只不过是 `type: 'prompt'` 的特殊命令

## 二、skill 可以定义什么

`loadSkillsDir.ts` 里会解析 skill frontmatter。

关键位置：

- `src/skills/loadSkillsDir.ts:185`

一个 skill 可以声明：

- `description`
- `when_to_use`
- `allowed-tools`
- `arguments`
- `model`
- `effort`
- `disable-model-invocation`
- `user-invocable`
- `hooks`
- `context: fork`
- `agent`
- `paths`
- `shell`

这些字段非常关键，因为它们决定 skill 不是一段纯文本，而是：

- 带执行策略
- 带权限
- 带模型偏好
- 带上下文边界

的可执行提示资产。

## 三、skill 是如何被转换成 Command 的

`createSkillCommand()` 会把解析后的 skill 转成 `Command`。

关键位置：

- `src/skills/loadSkillsDir.ts:267`

转换后的 skill command 具备：

- `type: 'prompt'`
- `name`
- `description`
- `allowedTools`
- `model`
- `effort`
- `context`
- `paths`
- `hooks`
- `getPromptForCommand()`

### getPromptForCommand() 负责什么

它会在真正运行 skill 前做这些处理：

- 参数替换
- 注入 `CLAUDE_SKILL_DIR`
- 注入 `CLAUDE_SESSION_ID`
- 对非 MCP skill 执行 shell prompt expansion

这点很重要。

skill 在 Claude Code 中并不是“读取 markdown 后原样塞给模型”，而是有一层编译和展开。

## 四、skill 从哪里加载

主入口是：

- `getSkillDirCommands()`

关键位置：

- `src/skills/loadSkillsDir.ts:638`

加载来源包括：

- managed skills
- user skills
- project skills
- `--add-dir` 下的额外 skills
- legacy `commands` 目录

之后还会：

- realpath 去重
- 区分 unconditional skill 和 conditional skill
- 把带 `paths` 的 skill 暂存，等命中路径后再激活

## 五、动态技能发现

Claude Code 的一个高级点是：

- skill 不只在启动时加载
- 还会在会话过程中动态发现

相关机制：

- `discoverSkillDirsForPaths()`
- `addSkillDirectories()`
- `activateConditionalSkillsForPaths()`
- `getDynamicSkills()`

关键位置：

- `src/skills/loadSkillsDir.ts:818`
- `src/skills/loadSkillsDir.ts:923`
- `src/skills/loadSkillsDir.ts:997`

这套机制意味着：

- 文件操作会影响 skill 可见性
- 更深层目录的 skill 可以覆盖更浅层目录
- skill 的可用集合是 session 内动态变化的

这和静态 prompt library 完全不同。

## 六、commands.ts 怎么把 skills 拼进系统

`commands.ts` 是命令总装配中心。

关键逻辑：

- `loadAllCommands()`
- `getCommands()`
- `getSkillToolCommands()`
- `getSlashCommandToolSkills()`

关键位置：

- `src/commands.ts:449`
- `src/commands.ts:476`
- `src/commands.ts:561`
- `src/commands.ts:586`

### 两类重要筛选

#### 1. 给 SkillTool 用的命令集合

`getSkillToolCommands()` 返回：

- prompt-based
- 可模型调用
- 非 builtin

这代表“模型能把哪些命令当作 skill 使用”。

#### 2. 给系统 init / slash skill 列表用的 skills

`getSlashCommandToolSkills()` 偏向：

- `loadedFrom === skills / plugin / bundled`
- 或 `disableModelInvocation`

这代表“当前可见的技能列表”。

## 七、用户手动 `/skill` 的执行路径

用户手动输入 `/xxx` 时，走的是：

- `processSlashCommand()`
- `getMessagesForSlashCommand()`

关键位置：

- `src/utils/processUserInput/processSlashCommand.tsx:692`

### 这里会先区分三类命令

- `local-jsx`
- `local`
- `prompt`

skill 属于：

- `prompt`

### 对 skill 的关键判断

#### 1. `userInvocable === false`

这种 skill 只能被 Claude 调用，不能被用户直接 `/skill` 调用。

#### 2. `command.context === 'fork'`

这种 skill 不在主线程 inline，而是走：

- `executeForkedSlashCommand()`

也就是 fork 成一个 subagent。

#### 3. 否则 inline

就进入：

- `getMessagesForPromptSlashCommand()`

把 skill 内容展开成新的 user/meta message，继续主线程 query。

## 八、模型通过 SkillTool 调用 skill 的路径

这是另一条完全不同的入口。

SkillTool 入口：

- `src/tools/SkillTool/SkillTool.ts:331`

### 1. validateInput

会检查：

- skill 名字是否合法
- skill 是否存在
- 是否允许模型调用
- 是否是 prompt-based command

### 2. checkPermissions

SkillTool 会给 skill 单独走 permission 逻辑。

它甚至支持：

- 针对 skill 名称生成 allow/deny/prefix 规则

这说明在 Claude Code 里：

- skill 调用不是普通文本行为
- 它被当成一种受控能力

### 3. call

SkillTool 的 `call()` 会进一步决定：

- 是 inline skill
- 还是 forked skill

## 九、inline skill vs forked skill

这是理解 Claude Code skill 最关键的点。

### inline skill

关键逻辑：

- `SkillTool.call()` 中，如果不是 `context === 'fork'`
- 就复用 `processPromptSlashCommand()`

关键位置：

- `src/tools/SkillTool/SkillTool.ts:638`

它做的事情是：

- 解析出 skill 对应的 prompt command
- 获取展开后的 messages
- 把这些 messages 插入当前主线程 conversation
- 用 `contextModifier` 动态修改上下文

`contextModifier` 可能带来的变化：

- 临时放宽 `allowedTools`
- 覆盖 `mainLoopModel`
- 覆盖 `effort`

所以 inline skill 本质上是：

- 在当前 agent 上下文里注入一段高优先级工作说明
- 并暂时修改这个 agent 的能力边界

### forked skill

关键逻辑：

- `command.context === 'fork'`
- 走 `executeForkedSkill()`

关键位置：

- `src/tools/SkillTool/SkillTool.ts:118`

它会：

- 准备 forked command context
- 选定 agentDefinition
- 创建新的 `agentId`
- 调 `runAgent()`

这时 skill 不再只是“展开成一段 prompt”，而是：

- 真正起一个 subagent
- 用独立上下文执行
- 最终再把结果以 tool result 形式回传

## 十、skill 最终仍然复用同一个 query runtime

无论是 slash-command forked skill，还是 SkillTool forked skill，最终都会进入：

- `runAgent()`

而 `runAgent()` 内部最终仍然调用：

- `query()`

关键位置：

- `src/tools/AgentTool/runAgent.ts:748`

这说明 Claude Code 并没有为 skill 再做一套单独 runtime。

整体关系是：

- skill 定义层：markdown/frontmatter
- skill 执行层：command / SkillTool
- subagent 执行层：runAgent
- 底层 loop：query()

## 十一、为什么 skill 设计成 command 很合理

这是一个非常值得借鉴的点。

如果 skill 直接成为另一套独立实体，会出现很多重复实现：

- 参数处理
- 可见性控制
- 模型调用权限
- hooks
- user invocation
- plugin / MCP 接入

Claude Code 通过把 skill 统一成 prompt command，复用了整个 command 体系。

这让：

- 用户手动调用 skill
- 模型自动调用 skill
- plugin skill
- bundled skill
- MCP skill

都可以用同一套抽象表达。

## 十二、对 code-orb 的建议

最值得借鉴的是：

### 1. skill 做成声明式 prompt asset

推荐继续保留：

- markdown
- frontmatter
- `getPromptForCommand()` 编译层

### 2. skill 和 tool 明确分层

- skill 是提示资产
- tool 是执行能力

不要把 skill 当作 tool。

### 3. 允许 skill 既可 inline，也可 fork

这会非常有用：

- 轻量工作流 inline
- 重任务 forked subagent

### 4. 动态发现和条件激活值得借鉴

特别是：

- 根据文件路径激活 skill
- 根据工作目录动态发现 skill

这很适合 coding agent。

## 十三、不建议直接照搬的部分

- shell expansion 直接混在 skill prompt 编译里，风险较高
- 过重的 telemetry 和 plugin marketplace 细节
- 太多来源叠加造成的复杂优先级

对 `code-orb` 更合理的是：

- 先支持本地 skills
- 再支持 plugin skills
- 最后才做 MCP skills

## 十四、一句话总结

Claude Code 的 skill 不是独立 agent runtime，而是构建在 command 体系上的声明式 prompt asset，可以被用户手动调用，也可以被模型通过 `SkillTool` 作为受控能力调用，并在需要时升级为 forked subagent。
