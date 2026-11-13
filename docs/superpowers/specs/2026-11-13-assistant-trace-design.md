# AI 助手输入输出组件升级

日期：2026-11-13。授权：用户要求全面替换 AI 助手现有输入输出组件，使用 shadcn Trace。按仓库约定先实施、验证，最后交用户审查；不重复请求本期许可。

## 范围与方案

采用 shadcn 官方 Base UI 系列组合：Trace 表示思考、技能加载和工具调用；Message / Bubble 表示用户消息与回复；Message Scroller 承担消息滚动、历史补入与定位；输入区按官方 Prompt Input 示例组合现有 InputGroup、Textarea、Button、Popover、Command。Trace 自身不提供文本编辑器，不能把输入框伪装成执行轨迹。

比较过仅替换工具行、完整替换对话输入输出、重写整个工作台三种范围。本期采用第二种，覆盖用户指定的完整输入输出，保留导航、画布布局、真实简历预览与业务差异计算。现有共享组件仍被其他页面使用时保留；只清理已无引用的旧助手组件。

官方来源：

- https://ui.shadcn.com/docs/components/base/trace
- https://ui.shadcn.com/docs/components/base/message
- https://ui.shadcn.com/docs/components/base/bubble
- https://ui.shadcn.com/docs/components/base/message-scroller
- https://ui.shadcn.com/docs/ai-elements/base/prompt-input

## 组件与数据

1. 官方 registry 源码放入 `src/components/ui/`，沿用本地 cn、Lucide 图标、公共动效与减少动效 hook。Trace 使用 Base UI Collapsible，不覆盖项目已有 Radix Collapsible，状态选择器不混用。
2. 用户消息为右对齐 Bubble，助手回复为开放式 Message。Markdown 继续使用现有 Streamdown 与代码块，保持安全渲染和稳定 key。复制、编辑、重新生成继续复用现有动作。
3. 思考采用可展开 Trace，显示实际文本；工具按真实 call、awaiting-confirm、result、error、cancelled 状态展示，不能把等待确认或取消写成成功。详情可查看真实参数与结果；失败重试、Diff 统计、画布入口继续有效。
4. 技能活动采用同一 Trace 结构，保留真实版本、来源与错误。写入确认以 Trace 展示待确认动作和差异，明确取消与确认应用，仍调用原 resolve。
5. 输入区保留 `/` 快捷指令、`$` 技能、参考简历与职位、可移除标签、深度思考、发送和停止。Enter 发送，Shift+Enter 换行，中文组合输入不发送。只有提交被接受才清空草稿。引用读取区分加载、失败和真实空数据，独立重试，不新增虚假上传入口。
6. 页面 store、消息协议、AI 运行循环、数据库与 Edge 不改；保留历史持久化、取消及账户隔离。非流式 UI 维持精确订阅，历史消息保持 memo。

## 交互与验收

- Trace 展开/收起、状态切换、消息与标签入场沿用公共 DURATION / EASE；所有新增动效接入运行中的 useReducedMotion。
- 检查桌面、390px、320px、深浅色、长中文与长参数，无横向溢出。
- 对展开项与输入浮层至少两轮完整开关及快速反向；键盘选择、Escape、焦点恢复、停止后的有效焦点、写入确认不可重复点击。
- 真实组件配合隔离合成会话验证流式思考/文本/工具、错误/取消/重试、编辑/复制/重生成、向上阅读不被拉回、搜索定位和补入历史。
- 执行改动文件 Prettier 与 ESLint layout、TypeScript、全项目格式检查、生产构建。临时验证文件放 `tests/`，完成删除；不 push，不发布前端。

## 已阅读的相关约束

已阅读 `docs/product-development-guardrails.md` 的 UI、动效、数据、交付、文案、助手流与请求规范；以及 `2026-09-17-assistant-skills-design.md`、`2026-10-13-business-review-fixes-design.md` 的助手约束、`2026-10-29-motion-completion-acceptance.md` 的助手验证、`2026-11-12-loading-experience-acceptance.md` 的相关加载记录。没有声称已读取全部历史。

## 用户补充要求

深度思考按钮在鼠标悬停时也需立即区分开关。使用主色与 ghost 按钮区分，保留 aria-pressed；按最新反馈不附加勾选标记。

助手回复不再展示每轮 token 输入、输出及合计；只移除界面显示和无用传参、订阅，保留内部用量统计与额度逻辑。

发送、输出和完成均按真实内容跟随底部，不生成轮次占位、不在结束时补偿跳转。同一回复从流式到保存保持组件实例和手动展开状态，临时身份随保存更新；完成与重新加载的消息高度一致。向上阅读时保持当前位置，不中断搜索定位；主动发送时恢复跟随。历史分页从助手回复开始时，补入前驱也必须保持已有行身份。

## 状态

- 实施：完成。
- 验证：页面验收与工程检查通过，具体范围及限制见 [验收记录](2026-11-13-assistant-trace-acceptance.md)。
- 用户审查：待交付后审查。
