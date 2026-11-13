# AI 助手 AI Elements 完整接入实现计划

> 面向 AI 代理：使用 subagent-driven-development 完成组件任务与审查。用户已授权实施，不重复索要确认；不执行 TDD，不提交或推送。

**目标：** 尽可能替换 AI 助手中可复用的 UI 和流处理，保留真实业务及滚动连续性。

**架构：** shadcn 官方模式承载输入输出；AI SDK DeepSeek provider、ToolLoopAgent 与 UI 消息流替代手写解析和循环。既有数据库 parts、确认桥与页面 store 通过薄适配保留。

**技术栈：** React、Zustand、shadcn/ui、Streamdown、AI SDK 6、DeepSeek provider 2、TypeScript。

## 任务 1：官方 UI 组件补齐

文件：`src/components/ui/{item,attachment,code-block}.tsx`、代码块消费者、`src/pages/assistant/components/{confirm-card,skill-picker,tool-call-part,text-part,message-bubble}/` 及消息操作组件。

- [x] 读取官方 registry 与 AI Elements 示例，核对实际 primitive 与依赖，替换确认卡、引用附件、工具代码展示、代码块和消息 Tooltip。
- [x] Streamdown 明确流式状态，保留正文语义、中文文案、复制下载与焦点；检查剩余原生表单和自定义交互是否有官方实现。
- [x] 保持已有 Message Scroller 与消息行身份，不恢复 anchor、不增加 token 展示或思考勾选。
- [x] 局部格式、类型检查与自审，记录官方来源及确实需要保留的业务逻辑。

## 任务 2：SDK 流与工具执行

文件：`src/lib/llm/call.ts`、`src/lib/ai/agent/agent-loop.ts`、新的 SDK 模型/消息适配、`tool-registry.ts`、`src/pages/assistant/hooks/use-chat-stream.ts`、包依赖。

- [x] 安装与现有 AI SDK 6 匹配的 DeepSeek provider，读取实际安装源码确认思考与工具协议。
- [x] 抽出原始 Response 请求入口，原 callLLM 继续兼容；复用鉴权、额度和 AbortSignal。
- [x] 将历史转为 SDK ModelMessage；ToolLoopAgent 接管多步循环，默认 12 步、无自动收费重试；工具执行按现有业务顺序串行。
- [x] SDK UI 消息流承载文本、思考、工具、技能数据；onParts 快照替代页面逐类增量拼接；删除失去消费者的 StreamParser 与 OpenAI 工具协议组装。
- [x] 真实 SDK 合成 SSE 验收正常、异常、取消、多步、历史、串行确认与额度异常。

## 任务 3：集成与交付

- [x] 逐项审计实际助手入口与官方模式覆盖情况，记录业务保留项和原因。
- [x] 使用实际组件与状态完成桌面、手机、减少动效、滚动和确认卡交互验收；读屏状态和焦点也需检查。
- [x] 独立审查改动与规格，修复发现的问题。
- [x] Prettier、ESLint layout、两份 tsc、format:check、build、diff --check；不把工具报错算通过。
- [x] 更新防回归清单与验收文档，分别记录实施、验证和用户审查状态，删除临时 tests 文件。
