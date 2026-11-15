# 经历资料界面实施与验证记录

日期：2026-11-14。

本记录保留第一版双栏页面与公共资料组件的实施证据。用户随后要求重构整个经历页，页面布局现按[资料库重构规格](2026-11-14-experience-library-redesign-design.md)实施；本记录中的双栏截图和结果不能作为新版布局通过的证据。原数据能力、上传、版本与账户隔离约束继续有效。后续集成和云端验证见[本期总验收](2026-11-14-assistant-harness-acceptance.md)。

实施状态：本子任务已完成。局部验证：完成，覆盖与边界见下文。主代理独立审查、正式应用外壳与云端端到端验收：待主代理执行。用户审查：未执行。本记录不代表已发布前端或已部署云端。

## 范围与依据

实施依据为已批准的 `2026-11-14-assistant-harness-design.md` 第 6.7 节和同日实施计划第 5 节，以及经历资料后端实施报告。已实际阅读产品防回归清单中 UI、动效、账户隔离、文案、列表与请求链路相关约束，历史布局优化规格、个人应用布局及层级二次调整规格，并复用现有 PageLayout、Item、Tabs、Command、Popover、ResponsiveDialog、AlertDialog、Collapsible、Skeleton、Spinner 与 Button。

使用 brainstorming 的已有批准规格及 writing-plans 的现有计划，不重复设计审批；过渡按 transitions-dev 模式与本项目 motion tokens 实施。按 review-animations 的标准检查入场、退出、重复操作、快速反向与运行中减少动效，以本仓库明确约束为准。未创建分支、提交或推送；未修改助手、AI 运行控制、资料 API、Supabase 函数与迁移；`kind` 服务端筛选由主代理补充。

## 文件与行为

- `src/pages/experience/`：history-style 目录，包含 components、hooks、const、index、store、types、utils。页面 store 只管理搜索、类型、分页、选中版本与手机面板/列表滚动。
- `src/features/experience-sources/`：受控上传弹层、资料选择器、可分页原文阅读器、简历关联弹层及共享列表 hook。
- `src/store/experience-sources/index.ts`：账户代次隔离、按查询/类型/页缓存元信息，按来源/精确版本/段落偏移缓存原文，并共享在途请求。失败不写为空结果；账户变更同步清空，旧请求不能回填。写后标记过期并保留旧内容，成功重命名与删除先使用可信结果更新目标，再刷新实际消费页；删除后移除目标缓存，避免重新选中已删来源。
- `src/components/ui/file-upload.tsx`、两个必要 hooks：通过真实 `pnpm exec shadcn add https://diceui.com/r/radix-vega/file-upload.json --yes` 安装 Dice Radix 实现。CLI 初次生成了 `cn` 依赖及 `radix-ui/internal` 引用；已改用项目 `@/lib/utils` 和 React hook，并执行 `pnpm remove cn`。package.json 与 pnpm-lock.yaml 最终没有本任务新增依赖。components.json 只新增 Dice registry。公共上传组件的过渡通过局部 CSS 变量接入 DURATION、EASE 和运行中的 useReducedMotion；未接入示例上传服务或假进度。
- `src/components/page-skeletons/experience.tsx` 与路由骨架：标题、操作、资料列表和阅读区域保持相同结构，不导入页面 store 或提取器。
- `src/App.tsx`、侧栏常量、面包屑：增加 /experience 登录门禁，以及「我的简历」后的「经历资料」。

资料页在可用内容宽度达到 900px 后使用 `clamp(17rem,30%,22rem)` 加阅读区；窄屏通过真实容器 ResizeObserver 判断，并采用先退后进的常驻面板，退出前移交焦点并设置 inert/aria-hidden，返回恢复列表滚动与条目焦点。短屏保留 PageLayout 的最小工作区高度，由页面滚动兜底。

资料连续行展示名称、格式/时间/状态和最多 160 字真实 previewText；正文保持原文字体与真实页码/段落位置，按后端每批 20 段继续读取。没有调用 AI、自动摘要或虚构统计。正文切换使用 CONTENT_SWITCH 的 wait 过渡，退出节点由 PresenceDiv 隔离。首批只对前 6 项使用 0.03 秒错峰；回访缓存不重播。删除目标有真实退出与局部位置过渡。

更多菜单接通下载原件、重命名、上传新版本、关联/取消关联简历、删除确认与失败重试。菜单退出后先回焦触发器再打开弹层；删除后回到稳定的上传入口。简历候选只读取 resume_id/display_name，不通过完整简历查询引入编辑器或正文。

上传与粘贴使用独立 Tab 草稿；逐文件只展示提取、保存、成功、失败、结果未确认等真实阶段。operationId 在任务创建时固定，重试保留同一份输入；未知结果先通过 getExperienceOperation 核对。只允许在提取阶段实际取消，保存开始后关闭面板仍继续执行，不宣称撤销落库。完成后释放任务中不再需要的原文/File 引用。提取模块在实际文件/粘贴提交后动态 import，PDF.js、fflate 没有被资料页或公共 barrel 静态引入。

## 公共接口

统一从 `@/features/experience-sources` 导出：

```ts
ExperienceSourcePicker({
  open,
  onOpenChange,
  onSelect,
  anchorRef?,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (references: ExperienceSourceReference[]) => void
  anchorRef?: RefObject<HTMLElement | null>
})

ExperienceUploadDialog({
  open,
  onOpenChange,
  onComplete?,
  initialTab?,
  sourceId?,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (references: ExperienceSourceReference[]) => void
  initialTab?: 'files' | 'paste'
  sourceId?: string
})

ExperienceSourceReader({
  sourceId,
  versionId?,
  blockId?,
  onLoaded?,
}: {
  sourceId: string
  versionId?: string
  blockId?: string
  onLoaded?: (result: ExperienceSourceReadResult) => void
})
```

桌面有 anchorRef 时采用 Popover + Command，无锚点入口采用 Dialog；手机使用既有 Drawer。选择器按来源 ID + 版本 ID 去重，只调用 onSelect，不发送消息。上传成功逐份回调 onComplete，仍不发送消息。关闭选择器保留检索文字与未提交选择；同账户重复打开共享缓存与在途读取。

从资料页点击「用于 AI 助手」只执行 `navigate('/assistant', { state: { experienceReferences } })`。从助手导航到 `/experience` 并传 `{ sourceId, versionId }` 时精确读取旧版本；来源失效显示错误和重试，不改成空态。

选择器桌面提交关闭不会把父层焦点重新抢回锚点；普通取消恢复锚点。实际浏览器验证父层使用 requestAnimationFrame 聚焦 textarea 时，桌面与手机 500ms 终态均保持在 textarea，因此没有修改共享 ResponsiveDialog。主代理已收到真实调用点需要相同时机的说明。

上传只掌握账户归属，不掌握助手会话 ID；主代理已接入发起上传时的会话/草稿版本归属检查，防止晚完成的上传写入切换后的草稿。

## 实际验证

验证使用独立 headless Chrome、本子任务启动的 Vite 127.0.0.1:5188，以及 `tests/assistant-harness/ui/` 下的合成材料与可控 fetch 传输；运行的是真实生产组件、真实资料 API 包装和真实 TXT/Markdown/粘贴提取器。没有操作真实用户 Chrome、真实账户资料、简历、AI 模型或计费接口。云端与 Edge/Storage 的正确性不能由这些合成 HTTP 结果替代。

主验证命令：

```sh
DENO_NO_PACKAGE_JSON=1 pnpm dlx deno run --allow-all --no-config --no-lock --node-modules-dir=none tests/assistant-harness/ui/browser.ts
DENO_NO_PACKAGE_JSON=1 pnpm dlx deno run --allow-all --no-config --no-lock --node-modules-dir=none tests/assistant-harness/ui/extended.ts
```

- browser.ts：36 项通过，0 pageerror。覆盖列表 10/10/3、回页零请求、正文 20+3、真实页码、桌面锚点 Popover、选择引用、重复打开保留搜索、重命名/下载/简历关联取消、两轮上传 Tab 草稿、多文件部分失败与同操作重试、保存结果不明后核对且不重复入库、携带草稿引用导航、A→B→A、列表失败重试、320/390/768/1024/1440px 无水平溢出、手机返回回焦、手机 Drawer、桌面/手机 textarea 终态焦点、运行中减少动效。唯一 warning 是 Motion 在开启减少动效后主动输出的提示；未出现 DialogDescription 或 aria-hidden 焦点警告。
- extended.ts：16 项通过，0 pageerror、0 warning。覆盖服务端文字筛选 8 条、文件 10+5、两个消费者共享在途请求、指定历史版本、失效出处错误与重试、刷新原文失败保留内容、上传新版本仍使用原 sourceId、删除失败/重试/成功回焦、Dialog/Drawer 退出中重新打开、手机面板快速反向、减少动效后 Drawer 正常卸载。
- focus.ts：记录桌面及手机 focusin 顺序，500ms 后 activeElement 均为父层 textarea。该脚本专门用于验证没有被锚点再次抢焦。
- visual.ts：实际生成稳定帧截图；已查看桌面深浅色、320px 列表/详情和 390×400 短屏上传图。此前未等待动画结束的截图为中间帧，不作为静态视觉终态证据。稳定截图使用 `settled-*` 命名。长中文名、正文行高、可达操作与暗色均实际通读。
- 本次改动文件执行局部 Prettier，再执行 ESLint --fix --fix-type layout；tsconfig.app 类型检查已通过。完整生产构建、正式路由认证门禁、包含侧栏的真实应用外壳、真实云端 API/Storage 与助手最终发送由主代理统一复核，未冒充已完成。

期间的失败只用于修正，不记作通过：初版隔离认证 fixture 被真实初始化事件清空；已建立独立、合成账户状态后验证。tests 被 watcher 排除，修改 fixture 后重启了本子任务 Vite，避免旧模块缓存影响结论。初始 Radix virtualRef 的严格 TS 类型不接受 nullable RefObject，已在可见锚点边界适配其真实 HTMLElement 类型。缓存命中与失败重试、手机焦点和上传结果未知均在修正后重新跑完整验证。

## 新问题与长期约束

1. 触发：来源删除成功后立即保留旧页等待刷新，自动选中可能再次选到已删来源。根因：显示缓存仍包含目标。约束：成功删除先从全部已缓存页和该来源原文缓存移除目标，再失效读取；不能仅改 selectedId。验收：删除失败保留原状态，成功后原条目退出且可回到有效入口，后续读取不命中旧正文。
2. 触发：仅在当前页筛选文件/文字会误报某类型为空并给出错误数量。根因：后端 list 原先没有类型条件。约束：类型筛选、count 与 range 必须使用相同服务端条件；不得全量读正文或将当前页冒充全部。主代理增加 kind 后已接入并验证 23 条混合资料。
3. 触发：手机列表/详情直接切 display 会瞬间消失并把焦点留在隐藏按钮。根因：可见状态与交互状态没有分开。约束：复用历史页的常驻面板、先退后进、退出前移交焦点与 inert，返回恢复滚动/入口。验收：320/390/768px、两轮及退出中反向、减少动效。
4. 触发：窄屏短视口中默认 70dvh 上传 Drawer 的标题/页脚挤压上传区。约束：只在手机短屏提高此业务弹层可用高度，继续让正文独立滚动与关闭按钮可达，不修改共享 Drawer 动画。

## 交接与清理

当前前端没有发布，本子任务没有部署云端。主代理需统一完成真实账户门禁、已链接 Supabase 线上 smoke、真实文件原件往返、助手选择/发送/删除出处与全应用外壳审查；生产网络应再次确认资料页/选择器不提前下载 PDF.js、fflate、编辑器或 WASM。模型调用未由本子任务执行。

`tests/assistant-harness/ui/` 按任务简报暂留供主代理复核，包含脚本、合成状态与截图，没有真实个人信息或凭据；最终由主代理按仓库规则清理。本子任务 headless Chrome 均由 browser.close() 结束，5188 Vite 已停止，lsof 核对该端口没有监听进程。用户已有浏览器、其他服务、主代理分支及源文件未受此子任务操作。

## 独立审查后的定向修复

本节记录主代理与只读审查确认的六项问题；仍属于同一期已授权范围，没有部署、提交或推送。

- `pending` 表示结果尚未完成，不等于一定仍有存活的服务端执行。原界面只能反复核对，会锁住函数中断后的预留操作。现在保留「核对结果」，并提供明确的「按原资料重试」：先查询已完成结果；仍 pending 时由用户明确发起同 operationId、冻结 sourceId/name/extracted/file 的保存恢复。不会创建新的操作身份。后台幂等与请求摘要校验继续由原 API 执行，不修改接口。
- SourceDetail 的上传完成回调以前只写页面 versionId，来源 A 晚完成可能改到后来选中的 B。现在在打开更新弹层时记录选中代次，并在完成时核对来源、选中代次、挂载状态、Presence 与当前路由。A→B、A→B→A 或离开页面后，保存与缓存失效仍完成，但不会污染新选择或弹出旧详情的成功 toast。
- Dice registry 的 accept 对扩展名原本区分大小写。只在入口比较处统一大小写，实际提取器维持现有实现；已用真实 TXT、MD、两页 PDF 与 DOCX 验证大写扩展名。
- 名称上限统一为后端实际支持的 160；长文件显示名截断到 160，原件名与提取 sourceName 保持原始值。粘贴失败时保留可编辑标题/原文，用户修正后可重新保存；只有任务成功且当前输入仍是该任务原稿时才清空，不覆盖后来输入的新草稿。未知结果任务仍保持原冻结载荷。
- 详情移除遍历所有缓存页找 source 的做法。当前消费页只有在非 stale 时才能提供当前元信息；否则依赖实际 read 返回的 source。旧 all 页 V1 不再先于新 files 页 V2 决定当前版本。
- `/experience` 同时支持 location state 与 URL query 的 `sourceId/versionId/blockId`。Reader 增加可选 blockId，单独通过 `blockIds: [blockId]` 限定读取精确版本的「引用段落」，同时保留完整原文分页；不顺序读取全部段落来找目标。定位在真实段落挂载后的 layout effect 执行，短强调使用 motion tokens 与运行中的减少动效；切换来源/版本/段落会重新建立目标并取消旧完成处理与定时器。失效段落明确报错并支持局部重试。

新增定向验证：

```sh
DENO_NO_PACKAGE_JSON=1 pnpm dlx deno run --allow-all --no-config --no-lock --node-modules-dir=none tests/assistant-harness/ui/review-regressions.ts
```

24 项通过，0 pageerror、0 warning。覆盖四种大写格式、长名称显示/原件分离、失败后修正、pending 原操作完全相同载荷恢复及 ready 优先、同一未确认文字草稿主按钮只核对原 ID 不新建任务、A→B/快速 A→B→A 的版本与 toast 隔离、stale V1/fresh V2、省略 versionId 时后续分页锁定首次真实版本以免外部更新混页、两种段落入口、单 blockIds 请求、真实页码、强调结束、失效重试与换目标后的晚响应取消。断言调用了真实 API 的请求摘要算法；传输夹具记录每次 save 的完整冻结载荷与哈希进行比较，没有复制保存业务实现。测试中初次把合法的 current 读取误判成串版本，已改为只拒绝 B 携带其他来源的显式版本；开发服务 HMR 导致的中途夹具重置也未记作产品检查通过，最终在稳定源码上整份重新执行。

复核入口和合成数据继续位于 tests/assistant-harness/ui，供主代理统一审查及清理。正式外壳、真实鉴权/Storage 和云端 smoke 仍由主代理完成；上述结果不代表线上已生效。

同一文字草稿在 reading/saving 时禁用重复保存，unknown 时主按钮显示「核对本次保存」并复用原操作查询；只有用户明确点击任务内「按原资料重试」才恢复同 ID 的保存。用户改写成另一份草稿仍可另行保存。完整原文首次按 current 读取后，后续段落固定使用首次返回的实际 versionId。

补充独立复核：只读审查代理使用另一个独立 Chrome 在 5188 实测确认，unknown 后点击主「核对本次保存」仍只有一次 save；点击「按原资料重试」后共两次 save，operationId 完全一致。该审查同时核对单 blockIds 精确出处请求、真实可见段落、1.4 秒后强调 opacity 为 0，以及无 pageerror。审查代理没有修改文件。最终局部 Prettier check、完整局部 ESLint、tsconfig.app 类型检查与 git diff --check 均退出 0；本轮 5188 服务再次停止并核对无监听，独立 Chrome 均已关闭。
