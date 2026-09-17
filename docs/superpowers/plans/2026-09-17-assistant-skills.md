# AI 助手内置 Skill 实现计划

> **面向 AI 代理的工作者：** 使用 subagent-driven-development 执行独立任务，控制者完成集成并审查。步骤使用复选框跟踪；用户已经确认设计，保持当前分支，不执行 TDD 或推送。

**目标：** 在现有 AI 助手完成 Codex 式 ASu 技能选择、真实加载、工具执行与多轮对话。

**架构：** 静态元数据目录与延迟加载的技能包分离；每次 Agent run 创建技能工具与加载状态。用户引用、真实加载活动通过现有 JSONB 消息 parts 保存；页面复用已有输入框、轨迹、Diff 与画布。

**技术栈：** React、TypeScript、Zustand、Vite raw imports、Motion、DeepSeek tool calling。

**规格：** `docs/superpowers/specs/2026-09-17-assistant-skills-design.md`。

## 任务 1：技能包与加载器

**职责范围：** `src/lib/ai/skills/types.ts`、`catalog.ts`、`loader.ts`、`builtin/great-resume/**`。不修改运行循环和页面。

- [x] 获取 ASu 当前上游 commit，审阅简历提升及其两份参考资料；写入来源说明、MIT 许可和适配记录。将本地文件、Python 账本、其它未接入技能替换成产品已有能力，保留事实边界和证据工作流程。
- [x] 实现规格的 `SkillDefinition`，导出 `BUILTIN_SKILLS` 与 `getSkillDefinition`。内置 id 为 `great-resume`，版本为 `1.0.0`，名称为 `ASu 简历提升`。
- [x] 实现延迟 raw import 加载器；版本不匹配抛中文错误，资源必须精确命中声明清单：`references/claim-evidence-ledger.md` 和 `references/business-analysis-evidence.md`。禁止路径归一化后跨出包，也不允许 URL。

```ts
export async function loadSkill(id: string, version?: string) {
  const skill = requireSkill(id, version)
  const { default: instructions } = await import('./builtin/great-resume/SKILL.md?raw')
  return { ...skill, instructions }
}
```

- [x] 对自身文件运行 `pnpm exec eslint src/lib/ai/skills`，汇报结果和来源 commit。

## 任务 2：输入框技能选择

**职责范围：** `src/pages/assistant/components/composer/**`、`components/skill-picker/**`、`composer-tools.tsx`、`store.ts`，必要时改 `src/components/ui/composer.tsx` / `slash-command-dropdown.tsx`。不修改 Agent 或 use-chat-stream。

- [x] 从 catalog 获取轻量技能信息；在现有 `/` 工具菜单中展示技能条目并可搜索。为原有通用 composer 增加最小扩展插槽以展示已选技能标签，支持移除、键盘导航、Escape、中文输入法组合键，不破坏已有快捷指令。
- [x] store 添加 `composerSkillIds` / `setComposerSkillIds`，切换会话、新建对话、reset 时清空选择；所有新动画接入 reduced motion。
- [x] 调用以下发送接口，成功接受后清除草稿与标签；非法输入保持草稿：

```ts
if (sendMessage(text, composerSkillIds)) {
  useAssistantStore.setState({ composerDraft: '', composerSkillIds: [] })
}
```

- [x] 选择技能不发送，也不插入 Skill 正文；菜单显示来源与用途。可用 `$` 搜索技能；输入完整 `$great-resume` 或 `/great-resume` 后跟任务时允许直接发送。
- [x] 聚焦 ESLint 与浏览器验证：连续两轮打开/关闭菜单、键盘选择、删除标签、切换对话、窄屏、减少动效。

## 任务 3：运行时与消息集成

**职责范围：** `src/lib/ai/types.ts`、`src/lib/ai/skills/references.ts` / `runtime.ts`、`src/lib/ai/agent/**`、`src/pages/assistant/hooks/use-chat-stream.ts`、`components/message-bubble/**`、`components/skill-activity/**`、`tool-retry.ts`、`utils.ts`。

- [x] 扩展消息 union，用户选择变成结构化引用；仅解析独立点名 token，排除邮件、内联代码和代码块中的 `$` 文本。支持规范名与 `asu` 别名；未知明确命令阻止发送并显示可操作错误。
- [x] `sendMessage` 同步校验、返回 boolean；已选择技能可使用默认任务文本发送。重试与重生成保留引用；历史编辑框把引用还原成可编辑 `$id`，重新解析新文本。
- [x] 每次 run 构造独立 Skill runtime，目录只含元数据；程序明确加载时发送 `onSkillActivity` 回调；自动调用使用运行期 `activate_skill` 和 `read_skill_resource` 工具。

```ts
const tools = [...getTools(), ...skillRuntime.tools]
const tool = tools.find(candidate => candidate.name === call.name)
if (signal.aborted) throw new DOMException('aborted', 'AbortError')
const result = await tool?.execute(call.args)
```

- [x] `toApiMessages` 按原有 parts 的时间顺序恢复每段 assistant/tool exchange，保留 DeepSeek reasoning 要求；历史技能结果只传 id/version/资料目录摘要。明确选择的真实正文单独放入本轮上下文；其它历史规则只在重新加载后生效。
- [x] 显示明确加载活动、自动激活与资源读取的中文状态；只使用真实事件。失败重试正确处理运行期技能工具。
- [x] 处理加载中取消、工具之间取消、重复激活、额度失败、用户消息保存失败、切换对话和部分结果保存。

## 任务 4：验证与审查

**职责范围：** `scripts/verify-assistant-skills.ts`、验证报告、规格和计划状态。

- [x] 使用 Node 原生 assert 验证明确引用解析、未知版本/路径、加载去重、每轮隔离、工具历史时序和重生成引用，测试必须覆盖真实行为，不用文本字符串扫描冒充行为验证。
- [x] 执行 `pnpm exec eslint` 对改动文件检查、`pnpm exec tsc --noEmit -p tsconfig.app.json` 和 `pnpm build`；区分仓库已有问题与新增错误。
- [x] 使用浏览器验证技能菜单、标签、发送后的加载轨迹、资料加载、写入确认、重生成与会话隔离；尽量使用现有登录会话。无法执行真实模型时记录明确原因并用受控请求验证界面链路。
- [x] 对完整 diff 做独立代码审查，修复重要问题后重跑相关检查。更新本计划、规格验收记录和 `.superpowers/sdd/progress.md`，不推送远端。

## 完成记录（2026-09-17）

已在当前 `main` 分支完成，未提交或推送。审查中修复了菜单搜索/键盘关闭边界、停止后的消息排序和预读后晚到确认问题。

- `pnpm verify:assistant-skills`：通过，包含 9 组技能运行验证、停止与会话隔离顺序验证、确认取消边界验证。
- 本次涉及的应用/运行时/验证脚本 ESLint：通过；共享 `src/components/ui` 沿用仓库的忽略配置，其交互通过浏览器验证。
- `pnpm build`：通过；保留项目已有循环 chunk 与体积提示。
- `pnpm exec tsc --noEmit -p tsconfig.app.json`：已执行，仅报告基线 `src/features/resume-comments/api/client.ts:658、672` 两处 UUID 模板字符串类型错误；本次代码无新增类型错误。
- 浏览器：桌面与 390px 移动布局、减少动效、菜单别名/分类/键盘/关闭、显式与工具激活、两份参考资料、刷新恢复、重生成/编辑引用、确认应用/拒绝、停止与延迟保存、切换会话、预读期间停止均通过。控制台无应用错误，减少动效测试触发 Motion 的预期提示。
- 最终独立审查通过，没有遗留 Critical 或 Important。

浏览器使用隔离的模拟身份、消息存储和模型 SSE 响应，读取实际内置 Markdown 并执行真实 Agent 和业务工具代码。没有向真实云端写入测试数据，也没有验证真实 DeepSeek 的技能选择准确率或改写质量。无需数据库迁移或 Edge Function 部署。
