# 助手交互与分区加载修正实现计划

**目标：** 落实最新七项反馈，明确上传文件入口与按需范围。

**架构：** 保持现有模型工具、档案原件和保存协议；官方UI组合替换默认样式；独立数据模块分别发布。

**技术栈：** React、Zustand、Tiptap、shadcn、AI SDK、Supabase。

用户授权实现后统一验收；按dispatching-parallel-agents将已定位且文件互不重叠的问题分别实施，root集成与独立审查。当前main，不TDD、不commit/push。临时脚本只在tests/assistant-followup，最后删除。不触碰原5173服务。

## 1. 输入框、Markdown与Context（root）

- [x] `src/components/ui/{input,textarea,input-group,combobox,select,input-otp}.tsx`：只去输入类focus ring，保留边框颜色、invalid、按钮焦点；核查OTP的实际焦点样式再决定。
- [x] `src/pages/assistant/components/message-bubble/text-part.tsx`：components映射table/thead/tbody/tr/th/td为官方Table组合，去默认表格外壳，保留代码与可信出处链。不改message-bubble/index（由任务2负责）。
- [x] `src/lib/ai/types.ts`、`agent-loop.ts`：AiContextUsage增加可选reasoningTokens，来源SDK outputTokenDetails.reasoningTokens；`context-usage/index.tsx`仅总量/Progress/三行，未知不假装0。
- [x] 实际表格、输入聚焦、Context键盘手机/深浅验证；使用实际计数函数检查`used = input + output`，推理不额外相加。

## 2. 上传与范围（upload_scope）

- [x] 入口名“上传文件”直接选择器；另“从职业档案选择”。解耦上传disabled与全库目录加载，上传中/失败/unknown可编辑但发送需完成或移除。
- [x] `store/source-scope.ts`显式档案优先限定：`selected.length ? selected : sources`，保留指定版本及对应元信息；运行入口与历史tool-retry采用相同规则，杜绝旧快照扩大。
- [x] 去`message-bubble/index.tsx`的SourceScopeSummary展示；内部scope存储保留。调整evidence/build-context指令明确指定材料，检索/读取限制继续实际检查；不要改root的text-part、Context、types/agent-loop。
- [x] 验证真实A/B资料、旧scope规范化、上传等待中发送/移除/失败、明确范围拒绝B与正常无引用检索。报告`/tmp/assistant-followup-upload-report.md`。

## 3. 工具栏完整字段存档（toolbar）

- [x] `simple-editor.tsx`移除SelectionArchive与只供其使用的memo；通过现有Toolbar加入命名存档入口，不改普通格式工具。新增`src/features/experience-sources/editor-archive/index.tsx`，删除无调用的selection-archive。
- [x] 从editor.getText取得完整字段，点击冻结；Dialog+Description+Input+Button，必填名称，正文只读摘要可见，唯一保存真实落库；共享persistExperienceUpload，失败/unknown原ID，账户取消，成功可查看。
- [x] 手机工具栏可达、原文不变、选区无浮层、两轮开关/快速反向、键盘、动态reduce、实际云端回读。报告`/tmp/assistant-followup-toolbar-report.md`。

## 4. 独立分区加载（loading）

- [x] history/store/history-data.ts及workspace/timeline/detail：当前正文与版本摘要分别发布状态，历史详情不再以currentResume未就绪整体阻塞，依赖正文的保存/对比按真实可用性禁用。
- [x] share/store/data.ts：allShares与resumeMap独立结果/错误，列表用已有名称回退；选项加载不阻止统计/列表。
- [x] optimize/store/reports.ts：摘要与当前报告独立发布，保留当前报告真实加载、错误、空态语义；无关请求不拖住结果。
- [x] 按只读审计记录其他页面共同依赖的必要等待，不机械重写；真延迟/失败互换检查、同账户刷新/切目标/切账户、保存动作门禁。报告`/tmp/assistant-followup-loading-report.md`。

## 5. 集成与交付

- [x] 修复真实保存发现的同内容异名丢失：reserve_experience_source新建去重加入名称；隔离数据库13项断言和独立审查通过后部署，真实工具栏及文件异名/同名保存下载复验，核对迁移账本与函数版本。

- [x] 各自Prettier→ESLint layout，root核对文件范围与新旧协议，独立审查本期副本差异。
- [x] `pnpm exec tsc --noEmit`、`pnpm build`、`pnpm format:check`、`git diff --check`；真实上传/模型/文件阅读与各区渐进显示、桌面手机深浅/键盘/动画。
- [x] 如无Edge/DDL修改不新增部署；否则完整验证后部署linked项目。清理测试账户、原件、脚本、服务，更新guardrails和验收，实施/验证/用户审查分别记录。

## 6. 用户追加的编辑栏调整

- [x] `section-row.tsx` 移除栏目最大高度和内部滚动，外层编辑列表统一滚动；保留折叠动效。
- [x] 仅在编辑入口的 `DrawerContent` 覆盖尺寸变量为 `90dvh`，沿用键盘避让与可用区约束。
- [x] 正式编辑页面验证长栏目、真实滚轮、底部可达、手机窄屏/短屏、两轮完整开关、反向切换和动态减少动效；记录实机键盘未测边界。
