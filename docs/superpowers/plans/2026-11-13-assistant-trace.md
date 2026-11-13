# AI 助手 Trace 升级实现计划

> 使用 subagent-driven-development 分担独立输入区实现与审查；在当前分支执行，不提交或推送，不做 TDD。规格见同日期 assistant-trace-design.md，已获本期实施授权。

**目标：** 完成 shadcn 官方输入输出组件替换，保持已有 AI 能力可用。

**架构：** 官方 UI primitive 负责展示和可访问性，页面组件映射既有消息与动作。业务状态继续由现有 Zustand store 和 hooks 管理。

**技术栈：** React 19、Base UI、shadcn、Motion、Streamdown、Zustand。

## 任务 1：官方 UI 基础与输出

- [x] 从官方 base-vega registry 引入 `src/components/ui/trace.tsx`、`message.tsx`、`bubble.tsx`、`message-scroller.tsx`，只安装 Scroller 所需运行依赖。Trace 内部直接使用 Base UI Collapsible，保留共享 Radix 组件。
- [x] 将 message-bubble、reasoning-part、tool-call-part、skill-activity、confirm-card 改为官方部件组合。映射 `call → running`、`awaiting-confirm → pending`、`error → error`；取消写明已取消，完成不设运行状态。保留真实差异、重试和画布动作。
- [x] Message Scroller 替换助手 AutoScrollContainer；使用 messageId、scrollAnchor、autoScroll、scrollToMessage，历史补入由官方 viewport 保持位置，移除重复的手动补偿。
- [x] 删除已无消费者的旧 reasoning / shimmer；共享 Markdown、代码块和其他页面滚动组件保留。

## 任务 2：输入区

文件：`src/pages/assistant/components/composer/`、`composer-tools/`、`skill-picker/`、`hooks/use-composer-context.ts`、`types.ts`、`src/components/page-skeletons/assistant.tsx`。仅此任务修改这些文件。

- [x] 读取官方 Prompt Input 示例，以现有 InputGroup、InputGroupTextarea、InputGroupAddon、InputGroupButton 组合输入框，不新增整套私有编辑器。
- [x] 用现有 Popover / Command 提供快捷指令和引用选择，支持 `/`、`$` 查询、键盘和移除标签，保留 TEMPLATE_PROMPTS 和技能 metadata。类型移动到页面 types.ts，解除旧 Gaia Composer 类型依赖。
- [x] 使用原 sendMessage / stopStreaming；发送时组合引用，接受发送才清空；中文组合输入拦截提交；流式时停止按钮可用，禁用状态与读屏同步。
- [x] 引用列表保留各自加载、错误、空态与重试；generation 继续隔离账户，成功刷新前保留同账户内容。
- [x] 对齐页面骨架；移除无消费者的 `src/components/ui/composer.tsx` 及仅它使用的工具选择器。
- [x] 对这些文件运行 `pnpm exec prettier <files> --write`、`pnpm exec eslint <files> --fix --fix-type layout`，报告类型检查结果。

## 任务 3：集成验证与审查

- [x] 使用本地真实组件的隔离合成数据；验证输入、输出、流式、停止、重试、确认、复制、编辑、重生成、定位、补入历史；不调用用户真实模型或写入私人简历。
- [x] 验证 320 / 390 / 1440 px、深浅色、连续两轮开合与快速反向、动态减少动效、控制台无非预期错误和焦点警告。
- [x] 按 review-animations 检查本次动效，独立代码审查覆盖规格与质量并修复发现。
- [x] `pnpm exec tsc --noEmit -p tsconfig.app.json`、`pnpm exec tsc --noEmit -p tsconfig.node.json`、`pnpm format:check`、`pnpm build`、`git diff --check`。
- [x] 删除 `tests/` 本次临时文件，新增验收记录并分别更新实施、验证、用户审查状态。前端保持未发布，用户审查未完成。

## 交付状态

实施完成；本期页面验证与工程检查通过；用户审查待进行。前端未发布，未提交或推送。详见 [验收记录](../specs/2026-11-13-assistant-trace-acceptance.md)。
