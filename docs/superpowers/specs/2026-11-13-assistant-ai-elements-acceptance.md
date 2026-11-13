# AI 助手 AI Elements 完整接入验收

日期：2026-11-13。范围为当前 AI 助手的输入、输出、过程展示及前端模型流；共享代码块的既有消费者同步适配。用户授权“尽可能的能替换的全部替换”。

## 替换结果

[shadcn AI Elements](https://ui.shadcn.com/docs/ai-elements) 当前以官方组件组合提供模式，没有独立的整套安装包。本轮按官方示例与 registry 源码接入，不以名称相同的自写组件冒充官方实现。

| 部位                 | 最终实现                                                           | 本轮处理                                                                    |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 会话与滚动           | Message Scroller / Message / Bubble                                | 保持此前官方实现与已验证的稳定行身份，不恢复轮次 anchor                     |
| 输入、指令与资源选择 | InputGroup / Command / Popover / Button                            | 保持真实发送、停止、中文输入法与快捷指令行为                                |
| 已选技能与资源       | Attachment / Content / Title / Actions                             | 替换 Badge 加按钮拼装；保留移除、键盘与焦点返回                             |
| 思考、技能与工具过程 | Trace / TraceCollapsible / TraceLine                               | 保持真实过程；工具参数和结果改用官方 CodeBlock                              |
| 写入确认             | Item / Media / Content / Description / Actions                     | 对齐官方 Confirmation 模式，保留真实差异、取消和确认                        |
| Markdown 与流式文字  | Streamdown 2.5.0                                                   | 明确 streaming/static、isAnimating；用官方 animated 替换自写 stream-in 动画 |
| 代码展示             | CodeBlock / Header / Content / Line / CopyButton                   | 替换旧的整段 codeToHtml 与原生按钮；官方增量高亮、按语言加载，组合保留下载  |
| 原始文本差异         | CodeBlock / Content / Line added、removed                          | 替换手写 pre 和差异行，保留真实差异计算与高度限制                           |
| 消息操作             | MessageFooter / Button / Tooltip                                   | 复制、编辑、重新生成采用 Tooltip，支持键盘触发                              |
| 会话列表             | Button / Input / DropdownMenu / Dialog                             | 最后一个原生会话按钮改为 Button，提供选中状态                               |
| 画布与业务列表       | 既有 Tabs / Collapsible / Table / ScrollArea / Empty / Skeleton 等 | 已使用 shadcn 基础组件；简历预览、字段差异、版本恢复继续组合业务内容        |
| 上游协议解析         | AI SDK 6.0.158 + DeepSeek provider 2.0.81                          | 删除前端手写 StreamParser、工具参数碎片解析和 OpenAI 消息协议组装           |
| 多步调用与消息流     | ToolLoopAgent / createUIMessageStream / readUIMessageStream        | SDK 管理循环、步数和完整消息快照；页面删除逐类 token 拼接                   |

新增 Item、Attachment、CodeBlock 和增量高亮的来源为 `https://ui.shadcn.com/r/styles/base-rhea/{item,attachment,code-block,use-highlighted-code}.json`，对接项目已有 Button、图标、中文文案及动效预设。代码块共享消费者包含更新日志与优化建议 JSON；没有扩大其它页面的 AI 流改造范围。

文字动画依据 [Streamdown 官方说明](https://streamdown.ai/docs/animation)，采用 fadeIn、公共 200ms 时长与公共缓动。动态减少动效后实际动画时长为 0；不依赖动画节点必须卸载才能判断降级成功。

## 继续保留的业务代码

- **数据与动作：** 简历字段差异、真实工具、技能资料、画布联动、写入确认、撤销和版本恢复没有可直接替代的通用 AI Elements 实现。UI 使用官方组件，业务动作继续由原系统完成。
- **历史与保存：** 数据库 AiMessagePart、分页、重跑截断、账户切换与会话运行锁继续使用现有 Zustand 和持久化协议。薄适配把 SDK UIMessage 转为既有 parts；SDK 官方读取器已负责文本和参数组装，不再叠加另一份 useChat 历史状态。
- **鉴权与计费：** 现有 llm-proxy 是共享的鉴权、额度预占、首段交付、结算与失败释放边界。读取了其 inspectSseEvent 和转发结算逻辑；服务端仍保留为账本检查交付事件的协议处理。它不是 AI Elements 的界面能力，也不能用 UI 组件替代。此次只抽出前端原始 Response 请求入口供 SDK 使用，没有改动后端、数据库或模型密钥管理。
- **运行顺序与取消：** 页面只容纳一个 pendingConfirm。SDK 工具通过本轮队列依次执行，尚未开始的写工具不提前显示“等待确认”；真正开始时用 SDK 自定义数据事件更新状态。
- **其它页面：** 优化分析等页面仍有自己的 ChainOfThought 和模型调用入口；它们不属于当前 AI 助手，本轮未把这些页面标记为已完成替换。

## 发现并修复的取消问题

独立审查用真实 SDK 和合成 SSE 复现：写工具开始后 10ms 停止，写入 50ms 后成功；SDK 已关闭输出流，最后 UI 快照仍停在 awaiting-confirm，页面会把真实成功误存为“工具未完成”。

修复后记录已启动工具的真实结果；取消时等待本轮队列收尾，将成功或失败结果合并回最终快照，再由现有保存逻辑持久化。队列里的未启动工具仍在执行前检查 AbortSignal，不能在停止后继续写入。成功与失败两个场景均已验证，独立复审通过。

## 实际验证

SDK 验收使用实际安装的 AI SDK、DeepSeek provider 和生产 runAgent，以合成上游响应验证真实协议处理，没有复制解析业务逻辑。14 项通过：

1. 任意字节分段 SSE、中文内容、推理与完整快照。
2. 片段化 JSON 参数、多步思考回传和照片数据剔除。
3. 多个写工具串行，取消结果准确保留。
4. 工具异常展示后可继续下一步。
5. 不完整 JSON 不会退化成空参数执行。
6. 未知工具明确失败。
7. 步数上限不再追加模型请求。
8. 请求错误对象保留，不自动重试收费调用。
9. 停止流式输出，保留已看到的正文。
10. 历史多轮工具恢复因果顺序与推理。
11. 已开始写入的成功结果在停止后保留，排队工具不执行。
12. 已开始写入的失败结果在停止后保留。
13. 技能 loading/ready 在 SDK 自定义数据部分中原位更新。
14. 技能读取失败可见，并阻止模型请求。

浏览器使用真实 MessageList、Composer、确认桥、相关组件、项目 CSS 与隔离会话：

| 场景                                    | 结果                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1440 / 390 / 320px × 1 / 12 / 40 段回复 | 9 组完成过程逐帧 scrollTop 与 scrollHeight 变化范围均为 0px；同一消息节点、22 行，无横向溢出 |
| 30 行中文代码流式完成                   | 滚动位置与高度变化范围均为 0px；复制、下载文件内容与文件名准确                               |
| 手动展开思考和工具后保存                | 节点、展开状态与高度保留                                                                     |
| 60 条历史，上滚后继续输出并完成         | 阅读位置保持 7603px；点击回到底部可恢复跟随                                                  |
| 全新短会话                              | scrollHeight 与 clientHeight 同为 788px，无 anchor、无额外滚动空白                           |
| 深度思考悬停连续切换四次                | 开关底色明显不同，只有脑图标，没有尾部勾选                                                   |
| Attachment / Tooltip                    | 键盘移除后焦点回输入框；消息操作聚焦显示提示，Escape 关闭                                    |
| 确认与取消                              | 普通与减少动效下分别确认两轮、取消两轮；焦点回消息区域，无残留                               |
| 退出中重新确认                          | 35ms 时旧卡 inert，opacity 为 0.807；新卡可打开并操作，无重复确认                            |
| SDK → 真正确认桥 → Item 卡              | 两个写工具第一项确认、第二项取消，只有第一项执行；保存状态为 result / cancelled              |
| 手机差异与会话按钮                      | 差异区域 288px 可滚动，增删行准确；会话按钮 Enter 可选择，选中态可读                         |
| 动态减少动效与深色手机                  | 动画时长降为 0，恢复后正常；320px 深色无溢出                                                 |
| 停止按钮                                | AbortSignal 被取消，草稿保留，消息数不增加                                                   |

浏览器另外验证真实前端 `requestLLM` 请求入口：使用会话 Authorization 和独立 X-Request-Id；配额响应头将剩余额度更新为 7；403 仍抛出正确的 QuotaExceededError（包含恢复时间）；两次业务调用共两次请求。此项用浏览器拦截返回合成响应，**没有调用真实云端模型或写用户数据**。

正常页面回归无 console error 或 page error；错误注入用例产生的 SDK 预期错误日志单独识别。已实际查看手机确认、差异和深色页面并通读中文文案。工程检查与清理状态见下方。

## 交付状态

- 实施完成；独立审查发现的一项 P1 已修复，复审无剩余确定的 P1/P2。
- 上述本地协议与页面验证通过。
- 应用和 Node TypeScript 检查通过；生产构建通过，用时 14.05s，保留既有大分包提示。
- 改动源码 Prettier 与 ESLint layout、全项目 `pnpm format:check`、`git diff --check` 通过；ESLint 为 0 errors、67 条既有 warnings。首次全量检查包含尚未清理的临时验收脚本而失败，清理后重新完整执行通过。
- 本轮 `tests/assistant-ai-elements/`、下载文件、截图、临时缓存已删除，隔离浏览器上下文已关闭；原开发服务保留。
- 用户审查待完成；前端未发布，无数据库迁移或 Edge 函数变更，未提交、未推送。
