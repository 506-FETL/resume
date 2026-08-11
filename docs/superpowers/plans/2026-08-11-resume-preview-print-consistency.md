# 简历预览与打印一致性重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 建立唯一的固定 A4 分页 DOM，使桌面、手机预览和 PDF 使用相同分页结果，并彻底消除跨页漏行、设备响应式差异和字体 fallback 漂移。

**架构：** 使用屏幕外固定宽度测量源采集真实文本行边界，生成连续无缺口的分页区间，再渲染唯一 PrintedPages。手机仅缩放 PrintedPages 外壳；打印只克隆 PrintedPages，并在 iframe 中重新测量验证布局签名，不应用第二套分页结果。

**技术栈：** React 19、TypeScript 5.9、Zustand 5、react-to-print 3、Fontsource、Vite 7

**验证约束：** 用户明确要求本仓库当前不写测试。本计划不新增测试框架或测试文件，使用 TypeScript、ESLint、生产构建、运行时布局签名和浏览器矩阵验证。

---

## 文件结构与职责

### 新增

- `src/components/resume/pagination/const.ts`：A4、分页容差和打印样式常量。
- `src/components/resume/pagination/types.ts`：边界、分页区间、状态和签名类型。
- `src/components/resume/pagination/utils.ts`：行边界采集、分页规划、签名计算与比较。
- `src/components/resume/pagination/use-pagination-plan.ts`：字体门禁、稳定测量、竞态取消和 ResizeObserver。
- `src/components/resume/pagination/canonical-paged-document.tsx`：测量源与唯一 PrintedPages。
- `src/components/resume/pagination/scaled-resume-document.tsx`：屏幕缩放外壳。
- `src/components/resume/pagination/use-resume-print.ts`：统一 react-to-print、iframe 字体等待和签名校验。

### 修改

- `package.json`、`pnpm-lock.yaml`：加入三套 Fontsource 包。
- `src/main.tsx`：全局加载规范字体 CSS。
- `src/lib/schema/resume/config/font.ts`：三套规范字体、旧值映射、字重和字体加载信息。
- `src/lib/schema/resume/persisted.ts`：兼容解析旧字体值。
- `src/lib/resume-template/editor/appearance.ts`：模板默认 appearance 使用规范字体值。
- `src/hooks/use-resume-styles.ts`：输出规范字体族和对应字重。
- `src/components/resume/runtime/context/resume-context.tsx`：补充规范字体名。
- `src/components/resume/runtime/TemplateRuntimeProviders.tsx`：Runtime 根节点应用字体。
- `src/components/resume/runtime/layouts/SidebarSkeleton.tsx`：移除 viewport 断点。
- `src/components/resume/scaled-readonly-preview.tsx`：使用统一缩放和分页组件。
- `src/pages/resume/editor/components/preview/index.tsx`：编辑器接入统一文档。
- `src/pages/resume/editor/index.tsx`：接入统一打印 Hook。
- `src/store/resume/export.ts`：区分 PrintedPages ref 与未分页 source ref，保存分页状态。
- `src/pages/resume/editor/components/export/index.tsx`：导出按钮显示准备状态。
- `src/pages/share/view/[token].tsx`：保存文档状态。
- `src/pages/share/components/pdf-export/index.tsx`：使用统一打印 Hook。
- `src/pages/history/components/version-pdf-export/index.tsx`：使用统一分页与打印 Hook。
- `src/pages/template/components/workbench/template-thumbnail.tsx`：迁移旧分页组件。

### 删除

- `src/components/resume/paged-resume-shell.tsx`
- `src/pages/resume/editor/components/preview/resume-wrapper.tsx`

### 不修改

- 简历业务字段与 Supabase schema。
- 模板 manifest 协议。
- 分享快照与历史快照协议。
- Word 文档 HTML 样式模型。

## 工作区保护

- 当前 `src/pages/resume/editor/components/toolbar/index.tsx` 已有用户将 Slider `step` 从 `2` 改为 `1` 的未提交改动。字体选项修改必须保留这两处改动。
- 当前 `src/pages/share/` 存在组件目录重命名。使用现有 `components/pdf-export/` 路径，不恢复旧 `share-pdf-export/`。
- 每次提交前运行 `git diff --cached --name-status`，只提交任务列出的文件。
- 不执行 `git push`。

---

### 任务 1：引入规范字体并兼容旧配置

**文件：**

- 修改：`package.json`
- 修改：`pnpm-lock.yaml`
- 修改：`src/main.tsx`
- 修改：`src/lib/schema/resume/config/font.ts`
- 修改：`src/lib/schema/resume/persisted.ts`
- 修改：`src/lib/resume-template/editor/appearance.ts`
- 修改：`src/hooks/use-resume-styles.ts`
- 修改：`src/components/resume/runtime/context/resume-context.tsx`
- 修改：`src/components/resume/runtime/TemplateRuntimeProviders.tsx`

- [ ] **步骤 1：安装三套自托管字体**

运行：

```bash
pnpm add \
  @fontsource-variable/noto-sans-sc@5.2.10 \
  @fontsource-variable/noto-serif-sc@5.2.9 \
  @fontsource/lxgw-wenkai@5.2.5
```

预期：三个包进入 `dependencies`，`pnpm-lock.yaml` 更新。

- [ ] **步骤 2：加载字体 CSS**

在 `src/main.tsx` 的 `./index.css` 之前增加：

```ts
import '@fontsource-variable/noto-sans-sc/wght.css'
import '@fontsource-variable/noto-serif-sc/wght.css'
import '@fontsource/lxgw-wenkai/500.css'
import '@fontsource/lxgw-wenkai/700.css'
```

字体 CSS 必须在应用入口加载，打印 iframe 才能从全局 stylesheet 复制相同 `@font-face`。

- [ ] **步骤 3：收敛字体 schema 与旧值映射**

将 `src/lib/schema/resume/config/font.ts` 替换为：

```ts
import { z } from 'zod'

export const RESUME_FONT_FAMILIES = {
  sans: 'noto-sans-sc',
  serif: 'noto-serif-sc',
  wenkai: 'lxgw-wenkai',
} as const

export const fontFamilyOptions = [
  { label: '无衬线', value: RESUME_FONT_FAMILIES.sans },
  { label: '衬线', value: RESUME_FONT_FAMILIES.serif },
  { label: '文楷', value: RESUME_FONT_FAMILIES.wenkai },
] as const

export const fontFamilyEnum = z.enum([
  RESUME_FONT_FAMILIES.sans,
  RESUME_FONT_FAMILIES.serif,
  RESUME_FONT_FAMILIES.wenkai,
])

export type ResumeFontFamily = z.infer<typeof fontFamilyEnum>

const LEGACY_FONT_FAMILY_MAP: Record<string, ResumeFontFamily> = {
  system: RESUME_FONT_FAMILIES.sans,
  'Microsoft YaHei': RESUME_FONT_FAMILIES.sans,
  SimHei: RESUME_FONT_FAMILIES.sans,
  Arial: RESUME_FONT_FAMILIES.sans,
  SimSun: RESUME_FONT_FAMILIES.serif,
  'Times New Roman': RESUME_FONT_FAMILIES.serif,
  Georgia: RESUME_FONT_FAMILIES.serif,
  KaiTi: RESUME_FONT_FAMILIES.wenkai,
}

export function normalizeResumeFontFamily(value: unknown): ResumeFontFamily {
  const parsed = fontFamilyEnum.safeParse(value)
  if (parsed.success)
    return parsed.data
  if (typeof value === 'string')
    return LEGACY_FONT_FAMILY_MAP[value] ?? RESUME_FONT_FAMILIES.sans
  return RESUME_FONT_FAMILIES.sans
}

export const fontSizeOptions = [
  { label: '小号 (12px)', value: 12 },
  { label: '正常 (14px)', value: 14 },
  { label: '中等 (16px)', value: 16 },
  { label: '大号 (18px)', value: 18 },
  { label: '特大 (20px)', value: 20 },
] as const

export const fontConfigSchema = z.object({
  fontFamily: fontFamilyEnum.default(RESUME_FONT_FAMILIES.sans),
  fontSize: z.number().min(10).max(24).default(14),
})

export type FontConfigType = z.infer<typeof fontConfigSchema>

export const DEFAULT_FONT_CONFIG: FontConfigType = {
  fontFamily: RESUME_FONT_FAMILIES.sans,
  fontSize: 14,
}

export function getFontFamilyName(fontFamily: ResumeFontFamily) {
  switch (fontFamily) {
    case RESUME_FONT_FAMILIES.serif:
      return 'Noto Serif SC'
    case RESUME_FONT_FAMILIES.wenkai:
      return 'LXGW WenKai'
    default:
      return 'Noto Sans SC'
  }
}

export function getFontFamilyCSS(fontFamily: ResumeFontFamily) {
  const familyName = getFontFamilyName(fontFamily)
  const generic = fontFamily === RESUME_FONT_FAMILIES.serif ? 'serif' : 'sans-serif'
  return `'${familyName}', ${generic}`
}

export function getResumeFontWeights(fontFamily: ResumeFontFamily) {
  return fontFamily === RESUME_FONT_FAMILIES.wenkai
    ? { normal: 500, medium: 500, bold: 700 }
    : { normal: 400, medium: 600, bold: 700 }
}
```

- [ ] **步骤 4：在 normalize 阶段迁移旧值**

将 `src/lib/schema/resume/persisted.ts` 的 font import 改为：

```ts
import {
  DEFAULT_FONT_CONFIG,
  fontConfigSchema,
  normalizeResumeFontFamily,
} from './config/font'
```

将 `normalizeFontConfig` 替换为：

```ts
export function normalizeFontConfig(value: unknown): FontConfigType {
  const input = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}
  const parsed = fontConfigSchema.safeParse({
    ...DEFAULT_FONT_CONFIG,
    ...input,
    fontFamily: normalizeResumeFontFamily(input.fontFamily),
  })
  return parsed.success ? parsed.data : DEFAULT_FONT_CONFIG
}
```

- [ ] **步骤 5：把规范字体应用到 Runtime 根节点**

先在 `src/lib/resume-template/editor/appearance.ts` 导入：

```ts
import { RESUME_FONT_FAMILIES } from '@/lib/schema'
```

把模板默认 appearance 中的：

```ts
fontFamily: 'system',
```

改为：

```ts
fontFamily: RESUME_FONT_FAMILIES.sans,
```

在 `useResumeStyles.ts` 中导入：

```ts
import {
  getFontFamilyCSS,
  getFontFamilyName,
  getResumeFontWeights,
  normalizeResumeAppearance,
  themeColorMap,
} from '@/lib/schema'
```

将 font 派生改为：

```ts
const font = useMemo(() => {
  const weights = getResumeFontWeights(fontConfig.fontFamily)
  return {
    familyName: getFontFamilyName(fontConfig.fontFamily),
    fontFamily: getFontFamilyCSS(fontConfig.fontFamily),
    nameSize: `${fontSize * 1.5}px`,
    jobIntentSize: `${fontSize}px`,
    sectionTitleSize: `${fontSize}px`,
    contentSize: `${fontSize * 0.875}px`,
    smallSize: `${fontSize * 0.75}px`,
    boldWeight: weights.bold,
    mediumWeight: weights.medium,
    normalWeight: weights.normal,
  }
}, [fontConfig.fontFamily, fontSize])
```

在 `ResumeFont` 接口和 `defaultFont` 中增加：

```ts
familyName: string
```

`defaultFont.familyName` 使用 `'Noto Sans SC'`，`defaultFont.fontFamily` 使用 `"'Noto Sans SC', sans-serif"`。

在 `TemplateRuntimeProviders.tsx` 中用根节点包裹 children：

```tsx
<ResumeContextProvider value={{ theme, spacing, font, layout }}>
  <div
    data-resume-runtime-root
    style={{
      fontFamily: font.fontFamily,
      fontSynthesis: 'none',
    }}
  >
    {children}
  </div>
</ResumeContextProvider>
```

- [ ] **步骤 6：验证字体迁移**

运行：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint \
  src/main.tsx \
  src/lib/schema/resume/config/font.ts \
  src/lib/schema/resume/persisted.ts \
  src/lib/resume-template/editor/appearance.ts \
  src/hooks/use-resume-styles.ts \
  src/components/resume/runtime
```

预期：退出码均为 `0`。

- [ ] **步骤 7：提交字体基础设施**

```bash
git add \
  package.json \
  pnpm-lock.yaml \
  src/main.tsx \
  src/lib/schema/resume/config/font.ts \
  src/lib/schema/resume/persisted.ts \
  src/lib/resume-template/editor/appearance.ts \
  src/hooks/use-resume-styles.ts \
  src/components/resume/runtime/context/resume-context.tsx \
  src/components/resume/runtime/TemplateRuntimeProviders.tsx
git diff --cached --name-status
git commit -m "refactor(resume): 统一跨设备简历字体"
```

---

### 任务 2：实现纯分页测量与签名工具

**文件：**

- 创建：`src/components/resume/pagination/const.ts`
- 创建：`src/components/resume/pagination/types.ts`
- 创建：`src/components/resume/pagination/utils.ts`

- [ ] **步骤 1：定义分页常量**

`const.ts`：

```ts
export const A4_PAGE_WIDTH = '210mm'
export const A4_PAGE_HEIGHT = '297mm'
export const PAGE_GAP_PX = 16
export const BOUNDARY_EPSILON = 0.5
export const MAX_STABILITY_FRAMES = 8

export const RESUME_PRINT_PAGE_STYLE = `
  @page {
    size: A4;
    margin: 0;
  }
  @media print {
    [data-resume-document] {
      gap: 0 !important;
    }
    [data-resume-page] {
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      break-after: page;
    }
    [data-resume-page]:last-child {
      break-after: auto;
    }
  }
`
```

- [ ] **步骤 2：定义分页类型**

`types.ts`：

```ts
export type PaginationStatus = 'measuring' | 'ready' | 'error'

export interface PageBoundary {
  offset: number
  key: string
}

export interface PageSegment {
  start: number
  end: number
  startKey: string
  endKey: string
}

export interface ResumeLayoutSignature {
  pageWidth: number
  pageHeight: number
  contentHeight: number
  fontFamily: string
  pages: Array<{
    startKey: string
    endKey: string
  }>
}

export interface PaginationSnapshot {
  segments: PageSegment[]
  signature: ResumeLayoutSignature
}

export interface ResumeDocumentState {
  status: PaginationStatus
  signature: ResumeLayoutSignature | null
  fontFamily: string
  fontWeights: number[]
  error: string | null
}
```

- [ ] **步骤 3：实现边界哈希与 DOM 路径**

在 `utils.ts` 中实现：

```ts
import type {
  PageBoundary,
  PageSegment,
  PaginationSnapshot,
  ResumeLayoutSignature,
} from './types'
import { BOUNDARY_EPSILON } from './const'

function hash(value: string) {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return (result >>> 0).toString(36)
}

function getNodePath(node: Node, root: HTMLElement) {
  const indexes: number[] = []
  let current: Node | null = node
  while (current && current !== root) {
    const parent = current.parentNode
    if (!parent)
      break
    indexes.push(Array.prototype.indexOf.call(parent.childNodes, current))
    current = parent
  }
  return indexes.reverse().join('.')
}

function isVisible(element: Element) {
  const targetWindow = element.ownerDocument.defaultView
  if (!targetWindow)
    return false
  const style = targetWindow.getComputedStyle(element)
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && style.contentVisibility !== 'hidden'
}
```

- [ ] **步骤 4：实现完整文本行边界采集**

继续在 `utils.ts` 中增加：

```ts
export function collectPageBoundaries(root: HTMLElement) {
  const targetDocument = root.ownerDocument
  const targetNodeFilter = targetDocument.defaultView?.NodeFilter
  const rootRect = root.getBoundingClientRect()
  const contentHeight = Math.max(root.scrollHeight, rootRect.height)
  const candidates: PageBoundary[] = [{ offset: 0, key: 'start' }]
  const walker = targetDocument.createTreeWalker(
    root,
    targetNodeFilter?.SHOW_TEXT ?? 4,
  )

  let current = walker.nextNode()
  while (current) {
    const text = current.textContent ?? ''
    const parent = current.parentElement
    if (text.trim() && parent && isVisible(parent)) {
      const range = targetDocument.createRange()
      range.selectNodeContents(current)
      Array.from(range.getClientRects()).forEach((rect, lineIndex) => {
        const offset = rect.top - rootRect.top
        if (rect.width > 0 && rect.height > 0 && offset > BOUNDARY_EPSILON) {
          candidates.push({
            offset,
            key: hash(`${getNodePath(current!, root)}:${text}:${lineIndex}`),
          })
        }
      })
      range.detach()
    }
    current = walker.nextNode()
  }

  root.querySelectorAll('[data-pagination-atomic], img, svg, hr').forEach((element) => {
    if (!isVisible(element))
      return
    const rect = element.getBoundingClientRect()
    const offset = rect.top - rootRect.top
    if (rect.width > 0 && rect.height > 0 && offset > BOUNDARY_EPSILON) {
      candidates.push({
        offset,
        key: hash(`${getNodePath(element, root)}:atomic`),
      })
    }
  })

  candidates.push({ offset: contentHeight, key: 'end' })
  candidates.sort((left, right) => left.offset - right.offset)

  const boundaries = candidates.filter((candidate, index) => (
    index === 0
    || Math.abs(candidate.offset - candidates[index - 1].offset) > BOUNDARY_EPSILON
  ))

  return { boundaries, contentHeight }
}
```

- [ ] **步骤 5：实现连续无缺口分页计划**

继续在 `utils.ts` 中增加：

```ts
export function buildPageSegments(
  boundaries: PageBoundary[],
  contentHeight: number,
  viewportHeight: number,
) {
  if (contentHeight <= 0 || viewportHeight <= 0)
    throw new Error('简历内容尺寸无效')

  const segments: PageSegment[] = []
  let start = 0
  let startKey = 'start'

  while (contentHeight - start > viewportHeight + BOUNDARY_EPSILON) {
    const limit = start + viewportHeight
    const endBoundary = boundaries
      .filter(boundary =>
        boundary.offset > start + BOUNDARY_EPSILON
        && boundary.offset <= limit + BOUNDARY_EPSILON)
      .at(-1)

    if (!endBoundary)
      throw new Error('当前页面内找不到完整文本行断点')

    segments.push({
      start,
      end: endBoundary.offset,
      startKey,
      endKey: endBoundary.key,
    })
    start = endBoundary.offset
    startKey = endBoundary.key
  }

  segments.push({
    start,
    end: contentHeight,
    startKey,
    endKey: 'end',
  })

  for (let index = 0; index < segments.length - 1; index += 1) {
    if (Math.abs(segments[index].end - segments[index + 1].start) > BOUNDARY_EPSILON)
      throw new Error('分页区间存在缺口或重叠')
  }

  return segments
}
```

- [ ] **步骤 6：实现签名和 iframe 复测入口**

继续在 `utils.ts` 中增加：

```ts
function roundMetric(value: number) {
  return Math.round(value * 100) / 100
}

export function createLayoutSignature({
  page,
  source,
  segments,
  fontFamily,
}: {
  page: HTMLElement
  source: HTMLElement
  segments: PageSegment[]
  fontFamily: string
}): ResumeLayoutSignature {
  const pageRect = page.getBoundingClientRect()
  return {
    pageWidth: roundMetric(pageRect.width),
    pageHeight: roundMetric(pageRect.height),
    contentHeight: roundMetric(Math.max(source.scrollHeight, source.getBoundingClientRect().height)),
    fontFamily,
    pages: segments.map(segment => ({
      startKey: segment.startKey,
      endKey: segment.endKey,
    })),
  }
}

export function measurePaginationSnapshot({
  page,
  viewport,
  source,
  fontFamily,
}: {
  page: HTMLElement
  viewport: HTMLElement
  source: HTMLElement
  fontFamily: string
}): PaginationSnapshot {
  const { boundaries, contentHeight } = collectPageBoundaries(source)
  const viewportHeight = viewport.getBoundingClientRect().height
  const segments = buildPageSegments(boundaries, contentHeight, viewportHeight)
  return {
    segments,
    signature: createLayoutSignature({
      page,
      source,
      segments,
      fontFamily,
    }),
  }
}

export function serializeLayoutSignature(signature: ResumeLayoutSignature) {
  return JSON.stringify(signature)
}

export function layoutSignaturesEqual(
  left: ResumeLayoutSignature,
  right: ResumeLayoutSignature,
) {
  return serializeLayoutSignature(left) === serializeLayoutSignature(right)
}
```

- [ ] **步骤 7：验证纯工具编译**

运行：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/components/resume/pagination
```

预期：退出码均为 `0`。

- [ ] **步骤 8：提交分页工具**

```bash
git add src/components/resume/pagination
git diff --cached --name-status
git commit -m "feat(resume): 新增完整文本行分页工具"
```

---

### 任务 3：实现字体门禁与稳定分页 Hook

**文件：**

- 创建：`src/components/resume/pagination/use-pagination-plan.ts`
- 修改：`src/components/resume/pagination/utils.ts`

- [ ] **步骤 1：实现 document 字体等待**

在 `utils.ts` 增加：

```ts
export async function waitForResumeFont(
  targetDocument: Document,
  familyName: string,
  weights: number[],
) {
  if (!targetDocument.fonts)
    throw new Error('当前浏览器不支持字体状态检测')

  await Promise.all(
    weights.map(weight =>
      targetDocument.fonts.load(`${weight} 16px "${familyName}"`)),
  )
  await targetDocument.fonts.ready

  const ready = weights.every(weight =>
    targetDocument.fonts.check(`${weight} 16px "${familyName}"`))
  if (!ready)
    throw new Error(`字体 ${familyName} 加载失败`)
}

export function nextAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}
```

- [ ] **步骤 2：实现 Hook 接口与过期请求取消**

`use-pagination-plan.ts`：

```ts
import type { PaginationSnapshot, PaginationStatus } from './types'
import { useEffect, useRef, useState } from 'react'
import { MAX_STABILITY_FRAMES } from './const'
import {
  layoutSignaturesEqual,
  measurePaginationSnapshot,
  nextAnimationFrame,
  waitForResumeFont,
} from './utils'

interface UsePaginationPlanOptions {
  page: HTMLElement | null
  viewport: HTMLElement | null
  source: HTMLElement | null
  contentVersion: string
  familyName: string
  weights: number[]
}

export function usePaginationPlan({
  page,
  viewport,
  source,
  contentVersion,
  familyName,
  weights,
}: UsePaginationPlanOptions) {
  const [status, setStatus] = useState<PaginationStatus>('measuring')
  const [snapshot, setSnapshot] = useState<PaginationSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const generationRef = useRef(0)
```

- [ ] **步骤 3：实现连续两帧稳定测量**

在 Hook 函数中加入 effect：

```ts
  useEffect(() => {
    if (!page || !viewport || !source)
      return

    const generation = ++generationRef.current
    let disposed = false
    let scheduledFrame = 0

    const isCurrent = () =>
      !disposed && generationRef.current === generation

    const measure = async () => {
      setStatus('measuring')
      setError(null)
      try {
        await waitForResumeFont(document, familyName, weights)
        let previous: PaginationSnapshot | null = null

        for (let frame = 0; frame < MAX_STABILITY_FRAMES; frame += 1) {
          await nextAnimationFrame()
          if (!isCurrent())
            return

          const current = measurePaginationSnapshot({
            page,
            viewport,
            source,
            fontFamily: source.ownerDocument.defaultView
              ?.getComputedStyle(source).fontFamily ?? familyName,
          })

          if (
            previous
            && layoutSignaturesEqual(previous.signature, current.signature)
          ) {
            setSnapshot(current)
            setStatus('ready')
            return
          }
          previous = current
        }

        throw new Error('简历布局在限定时间内未稳定')
      }
      catch (caught) {
        if (!isCurrent())
          return
        setStatus('error')
        setError(caught instanceof Error ? caught.message : '简历分页失败')
      }
    }

    const schedule = () => {
      cancelAnimationFrame(scheduledFrame)
      scheduledFrame = requestAnimationFrame(() => {
        measure().catch(() => undefined)
      })
    }

    const resizeObserver = new ResizeObserver(schedule)
    resizeObserver.observe(source)
    resizeObserver.observe(viewport)
    schedule()

    return () => {
      disposed = true
      generationRef.current += 1
      cancelAnimationFrame(scheduledFrame)
      resizeObserver.disconnect()
    }
  }, [
    contentVersion,
    familyName,
    page,
    source,
    viewport,
    weights,
  ])

  return { status, snapshot, error }
}
```

在 import 中增加 `getComputedStyle` 不需要额外 import。调用方传入的 `weights` 必须是稳定数组，后续由 `useMemo` 创建。

- [ ] **步骤 4：验证 Hook**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint \
  src/components/resume/pagination/use-pagination-plan.ts \
  src/components/resume/pagination/utils.ts
```

预期：退出码均为 `0`。

- [ ] **步骤 5：提交稳定测量 Hook**

```bash
git add src/components/resume/pagination
git diff --cached --name-status
git commit -m "feat(resume): 增加字体就绪与稳定分页门禁"
```

---

### 任务 4：实现唯一 A4 文档与共享缩放

**文件：**

- 创建：`src/components/resume/pagination/canonical-paged-document.tsx`
- 创建：`src/components/resume/pagination/scaled-resume-document.tsx`
- 修改：`src/components/resume/pagination/types.ts`

- [ ] **步骤 1：补充组件状态回调类型**

在 `types.ts` 增加：

```ts
export type ResumeDocumentStateChange = (state: ResumeDocumentState) => void
```

- [ ] **步骤 2：实现 ref 赋值 helper**

在 `canonical-paged-document.tsx` 顶部加入：

```ts
import type { PropsWithChildren, Ref } from 'react'

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') {
    ref(value)
    return
  }
  if (ref)
    ref.current = value
}
```

- [ ] **步骤 3：实现测量层和分页状态**

组件接口：

```ts
interface CanonicalPagedDocumentProps {
  appearance?: Partial<ResumeAppearanceConfig> | null
  contentVersion: string
  documentRef?: Ref<HTMLDivElement>
  sourceRef?: Ref<HTMLDivElement>
  onStateChange?: ResumeDocumentStateChange
}
```

组件内部：

```ts
const { appearance: resolvedAppearance, font } = useResumeStyles(appearance)
const pageMargin = resolvedAppearance.spacing.pageMargin
const fontWeights = useMemo(
  () => Array.from(new Set([
    font.normalWeight,
    font.mediumWeight,
    font.boldWeight,
  ])),
  [font.boldWeight, font.mediumWeight, font.normalWeight],
)
const [page, setPage] = useState<HTMLDivElement | null>(null)
const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
const [source, setSource] = useState<HTMLDivElement | null>(null)
const { status, snapshot, error } = usePaginationPlan({
  page,
  viewport,
  source,
  contentVersion,
  familyName: font.familyName,
  weights: fontWeights,
})

const handleSourceRef = useCallback((element: HTMLDivElement | null) => {
  setSource(element)
  assignRef(sourceRef, element)
}, [sourceRef])

const handleDocumentRef = useCallback((element: HTMLDivElement | null) => {
  assignRef(documentRef, element)
}, [documentRef])
```

`handleSourceRef` 与 `handleDocumentRef` 必须使用 `useCallback`，避免 ref callback 每次 render 先收到 `null` 后再次挂载而触发测量循环。

通过 effect 把状态上报：

```ts
useEffect(() => {
  onStateChange?.({
    status,
    signature: snapshot?.signature ?? null,
    fontFamily: font.familyName,
    fontWeights,
    error,
  })
}, [
  error,
  font.familyName,
  fontWeights,
  onStateChange,
  snapshot?.signature,
  status,
])
```

- [ ] **步骤 4：渲染屏幕外测量源**

```tsx
<div
  aria-hidden
  className="pointer-events-none fixed top-0 opacity-0"
  style={{
    left: '-100000px',
    width: A4_PAGE_WIDTH,
  }}
>
  <div
    ref={setPage}
    style={{
      position: 'relative',
      width: A4_PAGE_WIDTH,
      height: A4_PAGE_HEIGHT,
    }}
  >
    <div
      ref={setViewport}
      style={{
        position: 'absolute',
        inset: `${pageMargin}px`,
      }}
    >
      <div
        ref={handleSourceRef}
        data-resume-source
        style={{
          fontFamily: font.fontFamily,
          fontSynthesis: 'none',
        }}
      >
        {children}
      </div>
    </div>
  </div>
</div>
```

MeasurementSource 使用 `opacity: 0`，不用 `visibility: hidden` 或 `display: none`，确保行节点保持可见计算样式并参与布局。

- [ ] **步骤 5：渲染唯一 PrintedPages**

当 `snapshot` 尚未存在时使用一个临时区间：

```ts
const segments = snapshot?.segments ?? [{
  start: 0,
  end: viewport?.getBoundingClientRect().height ?? 1,
  startKey: 'start',
  endKey: 'measuring',
}]
```

PrintedPages：

```tsx
<div
  ref={handleDocumentRef}
  data-resume-document
  data-layout-signature={
    snapshot ? serializeLayoutSignature(snapshot.signature) : undefined
  }
  className="flex flex-col gap-4"
>
  {segments.map((segment, index) => (
    <div
      key={`${segment.startKey}-${segment.endKey}`}
      data-resume-page
      className="mx-auto overflow-hidden rounded-md border bg-white shadow-md"
      style={{
        width: A4_PAGE_WIDTH,
        height: A4_PAGE_HEIGHT,
        position: 'relative',
      }}
    >
      <div
        data-resume-page-viewport
        style={{
          position: 'absolute',
          inset: `${pageMargin}px`,
          overflow: 'hidden',
        }}
      >
        <div
          data-resume-page-clip
          data-page-index={index}
          data-start-key={segment.startKey}
          data-end-key={segment.endKey}
          style={{
            height: `${Math.max(1, segment.end - segment.start)}px`,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            data-resume-page-content
            style={{
              position: 'absolute',
              top: `${-segment.start}px`,
              left: 0,
              right: 0,
              fontFamily: font.fontFamily,
              fontSynthesis: 'none',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  ))}
</div>
```

- [ ] **步骤 6：实现共享缩放外壳**

`scaled-resume-document.tsx` 接口与核心：

```tsx
interface ScaledResumeDocumentProps {
  appearance?: Partial<ResumeAppearanceConfig> | null
  contentVersion: string
  documentRef?: Ref<HTMLDivElement>
  sourceRef?: Ref<HTMLDivElement>
  onStateChange?: ResumeDocumentStateChange
  className?: string
}

export default function ScaledResumeDocument({
  children,
  appearance,
  contentVersion,
  documentRef,
  sourceRef,
  onStateChange,
  className,
}: PropsWithChildren<ScaledResumeDocumentProps>) {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [scaledSize, setScaledSize] = useState<{ width: number, height: number } | null>(null)

  useLayoutEffect(() => {
    if (!viewport || !canvas)
      return
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const width = canvas.offsetWidth
        const height = canvas.offsetHeight
        const nextScale = width > 0
          ? Math.min(1, viewport.clientWidth / width)
          : 1
        setScale(nextScale)
        setScaledSize({
          width: width * nextScale,
          height: height * nextScale,
        })
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(canvas)
    measure()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [canvas, viewport])

  return (
    <div ref={setViewport} className={cn('w-full min-w-0', className)}>
      <div className="flex justify-center">
        <div
          className="relative"
          style={scaledSize
            ? { width: scaledSize.width, height: scaledSize.height }
            : undefined}
        >
          <div
            ref={setCanvas}
            className="absolute left-0 top-0 origin-top-left"
            style={{
              transform: `scale(${scale})`,
              visibility: scaledSize ? 'visible' : 'hidden',
              width: 'fit-content',
            }}
          >
            <CanonicalPagedDocument
              appearance={appearance}
              contentVersion={contentVersion}
              documentRef={documentRef}
              sourceRef={sourceRef}
              onStateChange={onStateChange}
            >
              {children}
            </CanonicalPagedDocument>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 7：验证组件**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/components/resume/pagination
```

预期：退出码均为 `0`。

- [ ] **步骤 8：提交规范文档组件**

```bash
git add src/components/resume/pagination
git diff --cached --name-status
git commit -m "feat(resume): 新增唯一 A4 分页文档"
```

---

### 任务 5：固定模板布局并迁移所有屏幕预览

**文件：**

- 修改：`src/components/resume/runtime/layouts/SidebarSkeleton.tsx`
- 修改：`src/components/resume/scaled-readonly-preview.tsx`
- 修改：`src/pages/resume/editor/components/preview/index.tsx`
- 修改：`src/pages/template/components/workbench/template-thumbnail.tsx`
- 删除：`src/pages/resume/editor/components/preview/resume-wrapper.tsx`

- [ ] **步骤 1：移除 Sidebar viewport 断点**

把：

```tsx
className="grid md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]"
```

改为：

```tsx
className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)]"
```

sidebar-left 与 sidebar-right 都继续使用 manifest 决定的节点顺序。

- [ ] **步骤 2：让 ScaledReadonlyPreview 复用共享缩放**

删除组件中的 `viewport/canvas/scale/scaledHeight/scaledWidth` 状态和 `useLayoutEffect`。Props 将：

```ts
onDocumentReadyChange?: (ready: boolean) => void
```

替换为：

```ts
sourceRef?: Ref<HTMLDivElement>
onDocumentStateChange?: ResumeDocumentStateChange
```

最终返回：

```tsx
<ScaledResumeDocument
  appearance={appearance}
  contentVersion={documentVersion}
  documentRef={documentRef}
  sourceRef={sourceRef}
  onStateChange={onDocumentStateChange}
  className={className}
>
  <ResumeTemplateRuntime
    data={data}
    manifest={manifest}
    appearance={appearance}
  />
</ScaledResumeDocument>
```

- [ ] **步骤 3：迁移编辑器 ResumePreview**

保留现有数据和 manifest 解析。删除本地缩放状态和 `ResumeWrapper`，增加 Props：

```ts
documentRef: RefObject<HTMLDivElement | null>
sourceRef: RefObject<HTMLDivElement | null>
onDocumentStateChange: ResumeDocumentStateChange
```

使用：

```tsx
<div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-auto p-3 md:p-8">
  <ScaledResumeDocument
    appearance={null}
    contentVersion={JSON.stringify([previewData, manifest.id, manifest.version])}
    documentRef={documentRef}
    sourceRef={sourceRef}
    onStateChange={onDocumentStateChange}
  >
    <ResumeTemplateRuntime data={previewData} manifest={manifest} />
  </ScaledResumeDocument>
</div>
```

`appearance={null}` 继续让 `useResumeStyles` 读取当前配置 Store。

- [ ] **步骤 4：迁移模板缩略图**

`template-thumbnail.tsx` 用 `ScaledResumeDocument` 替代 `PagedResumeShell`：

```tsx
<ScaledResumeDocument
  appearance={appearance}
  contentVersion={JSON.stringify([thumbnailPreviewData, manifest])}
>
  <ResumeTemplateRuntime
    data={thumbnailPreviewData}
    manifest={manifest}
    appearance={appearance}
  />
</ScaledResumeDocument>
```

保留外层 `aspect-210/297 overflow-hidden`。删除手写 `scale(0.38)`，共享缩放组件根据卡片宽度计算比例。

- [ ] **步骤 5：删除 ResumeWrapper**

删除：

```text
src/pages/resume/editor/components/preview/resume-wrapper.tsx
```

确认没有 import：

```bash
rg -n "ResumeWrapper|paged-resume-shell" src/pages/resume/editor src/components/resume
```

预期：`ResumeWrapper` 无输出；旧 PagedResumeShell 只剩历史导出引用，任务 7 删除。

- [ ] **步骤 6：验证屏幕预览迁移**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint \
  src/components/resume \
  src/pages/resume/editor/components/preview \
  src/pages/template/components/workbench/template-thumbnail.tsx
```

- [ ] **步骤 7：提交预览迁移**

```bash
git add \
  src/components/resume/runtime/layouts/SidebarSkeleton.tsx \
  src/components/resume/scaled-readonly-preview.tsx \
  src/pages/resume/editor/components/preview \
  src/pages/template/components/workbench/template-thumbnail.tsx
git diff --cached --name-status
git commit -m "refactor(resume): 统一桌面与移动预览文档"
```

---

### 任务 6：实现统一打印 Hook 与编辑器导出

**文件：**

- 创建：`src/components/resume/pagination/use-resume-print.ts`
- 修改：`src/store/resume/export.ts`
- 修改：`src/pages/resume/editor/index.tsx`
- 修改：`src/pages/resume/editor/components/export/index.tsx`

- [ ] **步骤 1：实现 iframe 布局复测**

`use-resume-print.ts` 中增加：

```ts
function getPrintElements(printDocument: Document) {
  const documentRoot = printDocument.querySelector<HTMLElement>('[data-resume-document]')
  const firstPage = printDocument.querySelector<HTMLElement>('[data-resume-page]')
  const viewport = printDocument.querySelector<HTMLElement>('[data-resume-page-viewport]')
  const source = printDocument.querySelector<HTMLElement>('[data-resume-page-content]')
  if (!documentRoot || !firstPage || !viewport || !source)
    throw new Error('打印文档结构不完整')
  return { documentRoot, firstPage, viewport, source }
}
```

- [ ] **步骤 2：实现 useResumePrint**

```ts
import type { RefObject } from 'react'
import type { ResumeDocumentState } from './types'
import { useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'
import { RESUME_PRINT_PAGE_STYLE } from './const'
import {
  layoutSignaturesEqual,
  measurePaginationSnapshot,
  waitForResumeFont,
} from './utils'

export function useResumePrint({
  contentRef,
  documentState,
  documentTitle,
}: {
  contentRef: RefObject<HTMLDivElement | null>
  documentState: ResumeDocumentState
  documentTitle: string
}) {
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle,
    pageStyle: RESUME_PRINT_PAGE_STYLE,
    print: async (iframe) => {
      if (!documentState.signature)
        throw new Error('简历分页尚未准备完成')
      const printDocument = iframe.contentDocument
      const printWindow = iframe.contentWindow
      if (!printDocument || !printWindow)
        throw new Error('当前浏览器无法创建打印窗口')
      if (typeof printWindow.print !== 'function')
        throw new Error('当前浏览器不支持 PDF 导出，请使用 Safari 或 Chrome')

      await waitForResumeFont(
        printDocument,
        documentState.fontFamily,
        documentState.fontWeights,
      )
      const { firstPage, viewport, source } = getPrintElements(printDocument)
      const clone = measurePaginationSnapshot({
        page: firstPage,
        viewport,
        source,
        fontFamily: printWindow.getComputedStyle(source).fontFamily,
      })
      if (!layoutSignaturesEqual(documentState.signature, clone.signature))
        throw new Error('打印布局尚未稳定，请重试')

      printWindow.focus()
      printWindow.print()
    },
    onPrintError: (_location, error) => {
      toast.error(error.message || 'PDF 导出失败')
    },
  })

  return useCallback(async () => {
    if (documentState.status === 'measuring') {
      toast.info('简历分页准备中')
      return false
    }
    if (documentState.status === 'error') {
      toast.error(documentState.error || '简历分页失败')
      return false
    }
    await handlePrint()
    return true
  }, [documentState, handlePrint])
}
```

- [ ] **步骤 3：扩展导出 Store**

Store 状态改为：

```ts
interface ResumeExportState {
  sourceRef: RefObject<HTMLDivElement | null> | null
  handlePrint: (() => Promise<boolean>) | null
  documentState: ResumeDocumentState
  setSourceRef: (ref: RefObject<HTMLDivElement | null>) => void
  setHandlePrint: (handlePrint: (() => Promise<boolean>) | null) => void
  setDocumentState: (state: ResumeDocumentState) => void
  exportToPdf: () => Promise<void>
  exportToDoc: () => void
}
```

默认状态：

```ts
sourceRef: null,
handlePrint: null,
documentState: {
  status: 'measuring',
  signature: null,
  fontFamily: 'Noto Sans SC',
  fontWeights: [400, 600, 700],
  error: null,
},
```

`exportToPdf` 检查 `documentState.status === 'ready'` 后调用 `await handlePrint()`。

`exportToDoc` 从：

```ts
const contentHtml = sourceRef.current.innerHTML
```

提取一次正文。删除 `firstPage` 和 `[data-resume-content]` 查询。

- [ ] **步骤 4：编辑器注册 refs、状态和打印 Hook**

`Editor` 增加：

```ts
const documentRef = useRef<HTMLDivElement | null>(null)
const sourceRef = useRef<HTMLDivElement | null>(null)
const [documentState, setDocumentState] = useState<ResumeDocumentState>({
  status: 'measuring',
  signature: null,
  fontFamily: 'Noto Sans SC',
  fontWeights: [400, 600, 700],
  error: null,
})
const handlePrint = useResumePrint({
  contentRef: documentRef,
  documentState,
  documentTitle: resumeName ? `${resumeName}-简历` : '我的简历',
})
```

Store 注册 effect：

```ts
useEffect(() => {
  setSourceRef(sourceRef)
}, [setSourceRef])

useEffect(() => {
  setDocumentStateInStore(documentState)
}, [documentState, setDocumentStateInStore])

useEffect(() => {
  setHandlePrint(handlePrint)
  return () => setHandlePrint(null)
}, [handlePrint, setHandlePrint])
```

两个 `ResumePreview` 调用都传：

```tsx
documentRef={documentRef}
sourceRef={sourceRef}
onDocumentStateChange={setDocumentState}
```

删除 Editor 现有 `useReactToPrint`。

- [ ] **步骤 5：导出 Dialog 显示分页状态**

读取：

```ts
const { exportToPdf, exportToDoc, documentState } = useResumeExportStore()
```

PDF 按钮：

```tsx
<Button
  variant="outline"
  onClick={handleExportPdf}
  disabled={documentState.status !== 'ready'}
>
  <Printer data-icon="inline-start" />
  {documentState.status === 'measuring' ? '准备中…' : '导出 PDF'}
</Button>
```

保留 Word 按钮可用。顺便按 shadcn 规范删除图标 `mr-2 size-4`，改用 `data-icon="inline-start"`。

- [ ] **步骤 6：验证编辑器导出**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint \
  src/components/resume/pagination/use-resume-print.ts \
  src/store/resume/export.ts \
  src/pages/resume/editor
```

- [ ] **步骤 7：提交统一打印与编辑器接入**

```bash
git add \
  src/components/resume/pagination/use-resume-print.ts \
  src/store/resume/export.ts \
  src/pages/resume/editor/index.tsx \
  src/pages/resume/editor/components/export/index.tsx
git diff --cached --name-status
git commit -m "refactor(resume): 统一编辑器预览与 PDF 导出"
```

---

### 任务 7：统一分享页和历史版本 PDF

**文件：**

- 修改：`src/pages/share/view/[token].tsx`
- 修改：`src/pages/share/components/pdf-export/index.tsx`
- 修改：`src/pages/history/components/version-pdf-export/index.tsx`
- 删除：`src/components/resume/paged-resume-shell.tsx`

- [ ] **步骤 1：分享页保存完整文档状态**

把：

```ts
const [documentReady, setDocumentReady] = useState(false)
```

改为：

```ts
const [documentState, setDocumentState] = useState<ResumeDocumentState>({
  status: 'measuring',
  signature: null,
  fontFamily: 'Noto Sans SC',
  fontWeights: [400, 600, 700],
  error: null,
})
```

`SharePdfExport` 改传：

```tsx
<SharePdfExport
  contentRef={documentRef}
  documentState={documentState}
  documentTitle={state.displayName || '简历'}
/>
```

`ScaledReadonlyPreview` 改传：

```tsx
onDocumentStateChange={setDocumentState}
```

- [ ] **步骤 2：分享 PDF 使用统一 Hook**

Props：

```ts
interface SharePdfExportProps {
  contentRef: RefObject<HTMLDivElement | null>
  documentState: ResumeDocumentState
  documentTitle: string
}
```

组件：

```tsx
const handlePrint = useResumePrint({
  contentRef,
  documentState,
  documentTitle: documentTitle ? `${documentTitle}-简历` : '简历',
})

return (
  <Button
    variant="outline"
    disabled={documentState.status !== 'ready'}
    onClick={() => void handlePrint()}
  >
    <FileDown data-icon="inline-start" />
    {documentState.status === 'measuring' ? '准备中…' : '下载 PDF'}
  </Button>
)
```

- [ ] **步骤 3：历史版本使用 CanonicalPagedDocument**

保留 snapshot 和 manifest 的加载。增加：

```ts
const [documentState, setDocumentState] = useState<ResumeDocumentState>({
  status: 'measuring',
  signature: null,
  fontFamily: 'Noto Sans SC',
  fontWeights: [400, 600, 700],
  error: null,
})
```

用：

```tsx
<CanonicalPagedDocument
  appearance={snapshot}
  contentVersion={JSON.stringify([snapshot, manifest])}
  documentRef={printRef}
  onStateChange={setDocumentState}
>
  <ResumeTemplateRuntime
    data={previewData}
    manifest={manifest}
    appearance={snapshot}
  />
</CanonicalPagedDocument>
```

替换旧 `PagedResumeShell`。

使用 `useResumePrint`：

```ts
const handlePrint = useResumePrint({
  contentRef: printRef,
  documentState,
  documentTitle: documentTitle ? `${documentTitle}-简历` : '简历',
})
```

只有 snapshot、manifest 和 `documentState.status === 'ready'` 后触发打印。离屏容器使用：

```tsx
{snapshot && previewData && manifest && (
  <div
    aria-hidden
    className="pointer-events-none fixed top-0 opacity-0"
    style={{ left: '-100000px' }}
  >
    <CanonicalPagedDocument
      appearance={snapshot}
      contentVersion={JSON.stringify([snapshot, manifest])}
      documentRef={printRef}
      onStateChange={setDocumentState}
    >
      <ResumeTemplateRuntime
        data={previewData}
        manifest={manifest}
        appearance={snapshot}
      />
    </CanonicalPagedDocument>
  </div>
)}
```

`opacity: 0` 保留真实布局；不要使用 `display: none` 或 `visibility: hidden`。

- [ ] **步骤 4：删除旧分页组件**

运行：

```bash
rg -n "PagedResumeShell|paged-resume-shell" src
```

预期：无引用后删除：

```text
src/components/resume/paged-resume-shell.tsx
```

- [ ] **步骤 5：验证两个入口**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint \
  src/pages/share/view/'[token].tsx' \
  src/pages/share/components/pdf-export \
  src/pages/history/components/version-pdf-export
```

- [ ] **步骤 6：提交分享与历史入口**

```bash
git add \
  src/components/resume/paged-resume-shell.tsx \
  src/pages/share/view/'[token].tsx' \
  src/pages/share/components/pdf-export \
  src/pages/history/components/version-pdf-export
git diff --cached --name-status
git commit -m "refactor(resume): 统一分享与历史 PDF 分页"
```

---

### 任务 8：静态与生产构建验证

**文件：**

- 核对：本计划全部修改路径

- [ ] **步骤 1：确认旧实现清理**

```bash
rg -n "PagedResumeShell|paged-resume-shell|onDocumentReadyChange|MM_TO_PX" src
```

预期：无输出。

```bash
rg -n "\\b(sm|md|lg|xl|2xl):" src/components/resume/runtime/layouts
```

预期：无决定简历正文结构的 viewport 类。

- [ ] **步骤 2：确认 Runtime 应用字体**

```bash
rg -n "data-resume-runtime-root|fontFamily|fontSynthesis" \
  src/components/resume/runtime/TemplateRuntimeProviders.tsx
```

预期：三项均有命中。

- [ ] **步骤 3：运行 TypeScript**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
```

预期：退出码 `0`。

- [ ] **步骤 4：运行目标 ESLint**

```bash
pnpm exec eslint \
  src/components/resume \
  src/hooks/use-resume-styles.ts \
  src/lib/resume-template/editor/appearance.ts \
  src/lib/schema/resume \
  src/main.tsx \
  src/pages/history/components/version-pdf-export \
  src/pages/resume/editor \
  src/pages/share \
  src/pages/template/components/workbench/template-thumbnail.tsx \
  src/store/resume/export.ts
```

预期：退出码 `0`。

- [ ] **步骤 5：运行生产构建**

```bash
pnpm build
```

预期：Vite 构建成功，字体资源生成到 `dist/assets`，无构建错误。

- [ ] **步骤 6：检查工作区**

```bash
git status --short
git log --oneline -8
```

预期：

- 本计划源码改动已提交。
- 用户原有 Toolbar 和分享目录重命名改动未被回退。
- 不存在新测试文件。

---

### 任务 9：浏览器一致性矩阵

**文件：**

- 不创建测试文件。
- 使用：`src/lib/template/fixtures/demo-resume.ts` 公开示例数据。

- [ ] **步骤 1：启动生产预览**

```bash
pnpm build
pnpm preview --host 127.0.0.1
```

记录 Preview URL。

- [ ] **步骤 2：验证公开模板示例**

在 `/template` 打开官方模板卡片或模板编辑器公开示例，检查 DOM：

```js
JSON.stringify({
  pageCount: document.querySelectorAll('[data-resume-page]').length,
  signature: document.querySelector('[data-resume-document]')?.getAttribute('data-layout-signature'),
  width: document.querySelector('[data-resume-page]')?.getBoundingClientRect().width,
  height: document.querySelector('[data-resume-page]')?.getBoundingClientRect().height,
  font: getComputedStyle(document.querySelector('[data-resume-runtime-root]')).fontFamily,
})
```

预期：

- `pageCount >= 1`
- signature 非空。
- 页面宽高比例接近 `210 / 297`。
- font 为三套规范字体之一。

- [ ] **步骤 3：验证窄容器只缩放**

在 Chrome DevTools Device Toolbar 中将同一页面 viewport 分别设为 `1440 × 900` 和 `390 × 844`，两次读取：

```js
JSON.stringify({
  pageCount: document.querySelectorAll('[data-resume-page]').length,
  signature: document.querySelector('[data-resume-document]')?.getAttribute('data-layout-signature'),
  runtimeGrid: getComputedStyle(
    document.querySelector('[data-resume-runtime-root] [class*="grid-cols"]'),
  ).gridTemplateColumns,
})
```

预期：

- 两次 `pageCount` 相同。
- 两次 signature 完全相同。
- sidebar 模板两次均保持相同双栏结构。

- [ ] **步骤 4：验证长内容边界**

在已登录浏览器使用用户截图对应简历，逐页记录：

```text
项目经历第一页最后一行：
项目经历第二页第一行：
有序列表编号序列：
屏幕页数：
打印预览页数：
```

预期：

- 编号连续，无 `1 → 3`。
- 无半行、缺行或重复行。
- 屏幕与打印预览首尾行一致。

- [ ] **步骤 5：验证三字体与 appearance**

依次切换：

```text
无衬线 / 衬线 / 文楷
字号 12 / 14 / 18
行高 1.0 / 1.6 / 2.0
页边距 0 / 16 / 50
```

每次等待 PDF 按钮从“准备中…”恢复，再打开打印预览。预期屏幕与打印页数、首尾行一致。

- [ ] **步骤 6：验证三个导出入口**

逐一验证：

```text
编辑器导出 PDF
分享页下载 PDF
历史版本导出 PDF
```

预期：

- `measuring` 时按钮禁用。
- ready 后可打开打印预览。
- iframe 签名不一致时阻止打印并 toast。

- [ ] **步骤 7：停止预览服务并记录残余风险**

停止 `pnpm preview` 会话。记录：

```text
Firefox Android 不支持 window.print。
部分应用内 WebView 可能不提供系统打印能力。
以上环境显示明确错误，不属于分页不一致。
```
