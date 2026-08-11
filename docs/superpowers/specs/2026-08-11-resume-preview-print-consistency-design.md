# 简历预览与打印一致性重构设计

- 日期：2026-08-11
- 状态：已批准，待实现计划
- 范围：编辑器预览、移动端预览、分享页、历史版本和 PDF 导出

## 1. 背景

当前简历在编辑器预览、移动端预览和浏览器打印中可能出现不同分页，严重时跨页内容会少一行或少一段。已确认的表现包括：

- 屏幕预览第一页显示有序列表第 1 条，第二页直接从第 3 条开始，第 2 条不可读。
- 同一份简历在屏幕预览与打印预览中的换行和分页边界不同。
- 手机端预览或导出的布局与桌面端不同。
- 内容、字号或间距刚发生变化时，导出可能捕获尚未稳定的分页结果。

本次目标是建立唯一的规范 A4 文档：桌面和手机只以不同缩放比例展示同一分页结果，PDF 只打印这份已经完成分页的 DOM。

## 2. 根因

### 2.1 固定像素硬裁剪

`PagedResumeShell` 当前把完整正文重复渲染到每一页，通过固定像素偏移和 `overflow: hidden` 裁切：

```text
第 N 页 = 完整正文向上移动固定页高 × N，再截取 A4 窗口
```

该算法不知道文本行、段落或列表项边界。文本行跨越裁剪线时，前一页只显示上半部分，后一页只显示下半部分，视觉上会像整行消失。

### 2.2 屏幕和打印存在第二次布局

`react-to-print` 会把目标 DOM 克隆到打印 iframe。打印 iframe 会重新应用样式、解析字体并执行媒体查询。当前裁剪偏移来自屏幕 DOM，但打印克隆可能产生不同的文本换行，因此原偏移不再对应同一行边界。

### 2.3 模板依赖 viewport 断点

`SidebarSkeleton` 使用 `md:grid-cols-*`。该断点取决于浏览器 viewport，而不是 A4 文档宽度：

- 手机预览可能退化为单栏。
- 桌面预览可能使用双栏。
- 打印 iframe 又可能采用另一断点结果。

同一模板因此存在多种正文结构。

### 2.4 字体来源不一致

当前字体选项依赖操作系统字体。桌面与手机可能缺少同一字体并使用不同 fallback；字形宽度变化会改变换行、内容高度和页数。

### 2.5 字体就绪后未重新分页

当前 `document.fonts.ready` 仅用于延迟 `ready=true`，字体加载完成后没有重新测量正文并生成新的分页结果。早期 fallback 字体的分页可能被错误标记为可导出。

### 2.6 页边距语义不一致

当前第一页仅设置顶部边距，后续页顶部为 `0`，所有页面均没有对应的底部边距。`pageMargin` 并未作为每页四边统一边距使用。

### 2.7 字体配置未应用到 Runtime 根节点

`useResumeStyles` 会计算 `font.fontFamily`，但当前 `ResumeTemplateRuntime` 下没有节点把该值应用为正文根字体。字体下拉修改了配置，却不能保证模板正文实际使用对应字体；屏幕与打印可能继续继承各自环境的默认字体。

## 3. 设计目标

1. 桌面、手机和 PDF 使用同一份固定 A4 分页结果。
2. PDF 导出不执行第二套分页算法。
3. 文本只在完整行之间分页，不切断字形或行框。
4. 页面尽可能填满；不要求章节、经历、段落或列表项整体移页。
5. 每页四边使用相同 `pageMargin`。
6. 模板正文布局不依赖设备 viewport。
7. 三套自托管开源字体保证跨设备字形一致。
8. 字体和分页稳定前禁止导出。
9. 打印 iframe 与原文档不一致时阻止导出。
10. 编辑器、分享页和历史版本使用同一套打印基础设施。

## 4. 非目标

- 不引入 Paged.js 或其他完整 CSS Paged Media 运行时。
- 不生成图片型 PDF。
- 不改变简历业务字段、模板 manifest 协议或分享快照协议。
- 不保证不支持系统打印的应用内 WebView 可以导出 PDF。
- 不新增测试框架或测试文件。
- 不重构 Word 文档的排版模型；只确保它继续读取一次未分页正文。

## 5. 统一文档架构

```text
ResumeTemplateRuntime
        ↓
CanonicalPagedDocument
  ├── MeasurementSource（屏幕外、未缩放、不会打印）
  └── PrintedPages（唯一分页结果、documentRef）
        ↓
ScaledResumeDocument（仅屏幕缩放，位于 documentRef 外）
        ↓
编辑器 / 分享页 / 历史版本 / react-to-print
```

### 5.1 `CanonicalPagedDocument`

职责：

- 使用固定 `210mm × 297mm` 页面。
- 在每页四边应用同一个 `pageMargin`。
- 渲染未缩放测量源。
- 等待字体并收集文本行边界。
- 生成分页计划。
- 根据分页计划渲染实际页面窗口。
- 暴露分页状态、未分页正文 ref、打印页面 ref 和布局签名。

该组件不感知外部 viewport，也不负责缩放。

### 5.2 `ScaledResumeDocument`

职责：

- 测量可用屏幕宽度。
- 计算 `min(1, availableWidth / documentWidth)`。
- 只对 PrintedPages 的外部容器应用 `transform: scale(...)`。
- 用缩放后的宽高占位，维持页面正常滚动。

缩放容器不在 `documentRef` 内，因此手机缩放不会进入打印 iframe。

### 5.3 目录结构

共享分页逻辑按职责放入：

```text
src/components/resume/pagination/
├── canonical-paged-document.tsx
├── scaled-resume-document.tsx
├── use-pagination-plan.ts
├── use-resume-print.ts
├── const.ts
├── types.ts
└── utils.ts
```

不创建 `index.ts` 桶文件；调用方直接导入具体文件。

现有 `paged-resume-shell.tsx` 在迁移完成后删除。`scaled-readonly-preview.tsx` 保留业务入口名称，但内部改用新组件。

## 6. A4 布局约束

### 6.1 页面与内容区

页面：

```text
width: 210mm
height: 297mm
```

内容区：

```text
left = pageMargin
right = pageMargin
top = pageMargin
bottom = pageMargin
```

测量时不再通过 `297 × 3.7795275591` 推算像素高度。组件渲染真实 A4 页面与内容区，通过 `getBoundingClientRect()` 读取浏览器实际 CSS 像素尺寸。

### 6.2 模板布局

简历 Runtime 内禁止使用 viewport 响应式类决定正文结构。`SidebarSkeleton` 的栏位完全由 manifest 的 skeleton 与 sidebar position 决定：

- `single-column` 始终单栏。
- `sidebar-left` 始终左侧栏。
- `sidebar-right` 始终右侧栏。
- `stacked` 始终堆叠。

手机端不会改变模板结构，只缩小完整 A4 页面。

### 6.3 打印样式

`@media print` 只允许：

- 去掉屏幕页间 gap。
- 去掉页面边框、圆角和阴影。
- 对每个页面设置 `break-after: page`。

禁止在打印媒体查询中改变：

- 页面或内容区宽高。
- `pageMargin`。
- 字体族、字号和字重。
- 行高、间距和栏位。
- 正文 display、position 或 overflow 规则。

## 7. 完整文本行分页算法

### 7.1 测量源

MeasurementSource 使用与 PrintedPages 完全相同的：

- 固定内容区宽度。
- 模板 manifest。
- 简历数据。
- appearance。
- 自托管字体。

MeasurementSource 位于屏幕外且 `opacity: 0`，保持真实布局和可测量的 computed visibility；它不进入打印 ref。

### 7.2 边界采集

分页器遍历测量源：

1. 对所有可见文本节点创建 `Range`。
2. 通过 `Range.getClientRects()` 获取实际行框。
3. 收集每个完整行框的顶部与底部。
4. 对无文本但有面积的原子元素收集元素顶部与底部。
5. 过滤零尺寸、隐藏和重复边界。
6. 将坐标归一化为相对测量源顶部的像素值。

每个边界包含稳定标识：

```ts
interface PageBoundary {
  offset: number
  key: string
}
```

`key` 由稳定 DOM 路径、文本内容和行索引计算出的确定性哈希组成，用于生成布局签名。data attribute 只保存哈希，不写入额外明文内容。

### 7.3 分页规则

本次明确采用“只保证完整文本行”：

- 不绑定章节标题与后续内容。
- 不绑定经历标题与正文。
- 不要求 `p` 或 `li` 整体位于同一页。
- 只禁止断点穿过文本行或原子元素。

对每一页：

1. 从上一页结束边界开始。
2. 计算该页内容区的最大结束位置。
3. 选择不超过最大位置的最远完整行/原子元素边界。
4. 若没有可用边界，报告分页错误，而不是盲目切断内容。
5. 下一页从同一边界继续。

分页区间必须满足：

```text
page[0].start = 0
page[n].end = page[n + 1].start
lastPage.end = contentHeight
```

不存在坐标缺口或重叠，因此不会漏行或重复行。

### 7.4 页面渲染

PrintedPages 复用同一份固定宽度 React 内容。每页：

- 将正文向上移动到该页 `start`。
- 可见窗口高度严格等于 `end - start`。
- 页面剩余区域保持空白。
- 窗口边界一定落在完整行或原子元素之间。

有序列表因复用完整 DOM 保持原始编号，不需要重建 `start`。

## 8. 字体一致性

### 8.1 规范字体

字体选择收敛为三套自托管开源字体：

| UI 选项 | 实际字体 | 用途 |
|---|---|---|
| 无衬线 | Noto Sans SC | 默认、现代简历 |
| 衬线 | Noto Serif SC | 正式、传统排版 |
| 文楷 | LXGW WenKai | 书写感排版 |

通过以下 Fontsource 包引入：

```text
@fontsource-variable/noto-sans-sc
@fontsource-variable/noto-serif-sc
@fontsource/lxgw-wenkai
```

字体资源由应用自身提供，不依赖设备安装字体或第三方 CDN。

### 8.2 旧值迁移

`normalizeFontConfig` 在解析旧快照时执行兼容映射：

```text
system / Microsoft YaHei / SimHei / Arial
→ Noto Sans SC

SimSun / Times New Roman / Georgia
→ Noto Serif SC

KaiTi
→ LXGW WenKai
```

新写入数据只保存三个规范值。旧分享快照、历史版本和本地配置无需数据库迁移即可读取。

### 8.3 字重

无衬线和衬线使用可变字体覆盖当前 `400/600/700`。文楷只加载实际需要的字体文件；若缺少某字重，必须在所有设备上使用同一合成规则，避免不同平台选择不同 fallback。

### 8.4 字体门禁

分页前：

1. 根据当前字体族和正文实际字重调用 `document.fonts.load()`。
2. 等待 `document.fonts.ready`。
3. 确认规范字体可用。
4. 再开始边界采集。

打印 iframe 中重复等待同一字体资源就绪，但不重新分页。

### 8.5 Runtime 字体应用

`TemplateRuntimeProviders` 在模板内容外增加规范 Runtime 根节点，显式应用：

```text
font-family
font-synthesis
```

正文、标题和富文本均从该根节点继承字体族。无衬线和衬线使用自身字重；文楷按统一规则使用 `500/700`，不允许回退到设备默认字体。

## 9. 稳定状态

```ts
type PaginationStatus = 'measuring' | 'ready' | 'error'
```

触发 `measuring`：

- 简历数据变化。
- manifest 变化。
- 字体族、字号或字重变化。
- 行高、模块间距或页边距变化。
- MeasurementSource 尺寸变化。

进入 `ready` 的条件：

1. 字体已就绪。
2. 边界采集成功。
3. 分页区间覆盖完整正文且无缺口。
4. 连续两个 animation frame 得到相同分页计划与布局签名。

进入 `error`：

- 规范字体无法加载。
- 正文宽高为零。
- 找不到合法完整行边界。
- 分页区间存在缺口、重叠或无法推进。

重新测量期间保留上一份 PrintedPages，避免页面闪烁，但所有 PDF 按钮保持禁用。

## 10. 布局签名

每次分页生成：

```ts
interface ResumeLayoutSignature {
  pageWidth: number
  pageHeight: number
  fontFamily: string
  pages: Array<{
    startKey: string
    endKey: string
  }>
}
```

签名以可序列化字符串写入 PrintedPages 的 data attribute，同时保留结构化值供打印 hook 比较。该 attribute 只用于调试和定位，不可单独作为一致性证据，因为打印 iframe 会原样克隆它。

签名用于证明：

- 页数一致。
- 每页首尾行一致。
- A4 尺寸一致。
- 字体族一致。

## 11. 统一打印 Hook

`useResumePrint` 封装 `react-to-print`：

1. 仅在 PaginationStatus 为 `ready` 时允许调用。
2. `contentRef` 始终指向 PrintedPages。
3. 使用统一 A4 `pageStyle`。
4. 通过自定义 `print(iframe)` 等待 iframe 字体就绪。
5. 在 iframe 中对克隆内容重新采集行边界并计算一份验证分页计划，但不修改克隆 DOM。
6. 比较新计算的页数、每页起止行、A4 尺寸和实际字体族，而不是直接比较被克隆的 data attribute。
7. 与原 PrintedPages 签名一致后调用 `iframe.contentWindow.print()`。
8. 不一致则拒绝打印并返回明确错误。

该 hook 不设置分页状态、不修改正文，也不在 iframe 中应用新的分页结果；iframe 测量只用于验证克隆布局没有漂移。

## 12. 各入口接入

### 12.1 编辑器

`ResumePreview`：

- 使用 `ScaledResumeDocument`。
- 提供 PrintedPages `documentRef`。
- 提供 MeasurementSource `sourceRef`。
- 将 PaginationStatus 注册到导出 Store。

`useResumeExportStore`：

- PDF 在状态非 `ready` 时提示“简历分页准备中”。
- Word 从 `sourceRef` 提取一次未分页正文。
- 不再只查询第一页的 `data-resume-content`。

`Editor`：

- 使用 `useResumePrint`。
- 删除页面内独立的 `useReactToPrint` 配置。

### 12.2 分享页

- `ScaledReadonlyPreview` 暴露同一 PrintedPages ref 和状态。
- 下载按钮在 `ready` 前显示“准备中…”。
- `SharePdfExport` 改用 `useResumePrint`。
- 屏幕展示与 PDF 使用同一分页 DOM。

### 12.3 历史版本

- 历史版本预览继续使用 `ScaledReadonlyPreview`。
- PDF 导出使用同一 `CanonicalPagedDocument` 与 `useResumePrint`。
- 删除独立的分页和打印配置。
- 快照和 manifest 尚未加载时保持 loading。

### 12.4 其他预览

模板工作台、求职看板和 AI 助手中的 `ScaledReadonlyPreview` 自动获得固定 A4 与统一字体行为，但不新增打印入口。

## 13. 错误处理

| 场景 | 行为 |
|---|---|
| 分页中 | 保留上一画面，禁用 PDF，显示“准备中…” |
| 字体加载失败 | 状态为 error，提示“简历字体加载失败，请刷新重试” |
| 分页无法推进 | 状态为 error，提示“简历分页失败，请调整内容后重试” |
| 打印 iframe 签名不同 | 阻止导出，提示“打印布局尚未稳定，请重试” |
| 浏览器不支持打印 | 提示“当前浏览器不支持 PDF 导出，请使用 Safari 或 Chrome” |
| 用户取消打印 | 不显示错误 |

不得在签名不一致时继续打印，也不得回退到旧固定像素盲切算法。

## 14. 性能

- 字体按实际选择加载，未选字体不参与分页门禁。
- 边界采集在 animation frame 中执行。
- 使用 `ResizeObserver` 合并尺寸变化。
- 相同内容版本、appearance 和 manifest 不重复生成分页计划。
- 连续编辑期间允许取消过期测量，只有最新版本可提交结果。
- 页面仍可复用完整 React 内容，不进行 HTML 字符串重写。

## 15. 验证策略

用户已明确本仓库当前不写测试。本次不新增测试框架或测试文件。

### 15.1 静态验证

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint \
  src/components/resume \
  src/hooks/use-resume-styles.ts \
  src/lib/schema/resume \
  src/pages/history/components/version-pdf-export \
  src/pages/resume/editor \
  src/pages/share
pnpm build
```

### 15.2 运行时验证

每次打印自动执行布局签名比较。签名不一致即拒绝导出。

### 15.3 浏览器矩阵

覆盖：

- 模板：单栏、左/右侧栏、堆叠。
- 字体：无衬线、衬线、文楷。
- viewport：桌面宽视口、手机窄视口。
- 内容：跨页有序列表、超长单段、连续多条经历。
- appearance：字号、行高、模块间距、页边距变化。
- 入口：编辑器、分享页、历史版本。

逐页核对：

- 页数。
- 每页第一行和最后一行。
- 有序列表编号连续。
- 无缺行、重行或半行。
- 手机与桌面正文结构一致。
- 打印预览与屏幕分页一致。

自动化浏览器没有当前用户登录态，因此使用公开示例数据验证通用分页；当前真实简历由用户在已登录浏览器完成最终视觉确认。

## 16. 验收标准

1. 项目中只有一套 A4 分页算法。
2. 打印不重新分页。
3. 手机端只缩放，不改变正文布局。
4. 模板 Runtime 不使用 viewport 断点决定简历栏位。
5. 每页四边使用相同 `pageMargin`。
6. 文本只在完整行之间分页。
7. 分页区间覆盖完整正文，无缺口和重叠。
8. 三套字体均由应用自托管。
9. 旧字体值可兼容读取并映射到最接近的规范字体。
10. Runtime 根节点实际应用所选规范字体。
11. 字体和分页稳定前不能导出。
12. 打印 iframe 签名不同会阻止导出。
13. 编辑器、分享页和历史版本共用打印 hook。
14. Word 导出仍只包含一份完整正文。
15. TypeScript、ESLint 和生产构建通过。
