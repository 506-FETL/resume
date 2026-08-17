# AI 助手体验与简历 Schema 优化 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 AI 助手对话与简历渲染的 7 个体验问题：给大模型注入简历字段 schema、变更记录字段级中文对比+快捷操作、对话分页加载、流式自动滚动失效、工具调用即时反馈、隐藏项渲染空行、条目级隐藏按钮。

**架构：** 从现有 Zod schema 自动派生一份紧凑结构说明注入 AI 上下文（根治盲写）；StreamParser 暴露进行中工具名以即时上屏工具行；自动滚动改用户意图检测；消息反向游标分页；简历 item 增加 `hidden` 字段并在渲染/评论核心统一过滤，编辑器加眼睛按钮；变更记录改字段级中文 diff 并补齐批量应用/撤销、跳转高亮、单条撤销/重做、失败重试。

**技术栈：** React 19、TypeScript、Zustand、Zod 4、Supabase、lucide-react、motion、Tailwind 4。

**约定：** 本仓库无单元测试、不执行 TDD（见 AGENTS.md）。每个任务用「构建校验 + 手动验收」替代红绿测试。构建校验统一用：`pnpm lint` 与 `pnpm exec tsc --noEmit`（TS 类型检查）。提交信息遵循 `type(scope): description` 中文格式。默认在当前分支工作，不 push。

---

## 文件结构

### 需求① 简历 Schema 注入（新增）
- 创建：`src/lib/ai/schema-doc/build-schema-doc.ts` — 从 Zod 派生紧凑结构说明的生成器。
- 创建：`src/lib/ai/schema-doc/index.ts` — barrel 导出 + memo 缓存。
- 修改：`src/lib/ai/agent/build-context.ts` — 末尾注入结构说明。
- 修改：`src/lib/ai/tools/resume.ts:81` — 精简强化工具描述。

### 需求⑤ 工具即时反馈
- 修改：`src/lib/ai/agent/stream-parser.ts` — 暴露进行中 tool_calls 快照。
- 修改：`src/lib/ai/agent/agent-loop.ts` — 循环内触发 `onToolCallPending`。
- 修改：`src/pages/assistant/hooks/use-chat-stream.ts` — pending 即上屏转圈工具行。

### 需求④ 自动滚动
- 修改：`src/components/ui/auto-scroll-container.tsx` — 用户意图检测 + 程序化滚动标记。

### 需求③ 对话分页
- 修改：`src/lib/supabase/ai/messages.ts` — `listMessages` 支持 `{ limit, before }`。
- 修改：`src/pages/assistant/store.ts` — 分页状态 + `prependOlderMessages`。
- 修改：`src/pages/assistant/hooks/use-assistant-navigation.ts`、`use-assistant-bootstrap.ts` — 首屏只拉最新页。
- 修改：`src/pages/assistant/components/message-list/index.tsx` — 顶部哨兵加载更早 + 滚动补偿。

### 需求⑥⑦ 简历条目显隐
- 修改：`src/lib/schema/resume/form/shared.ts` — item 增加 `hidden`。
- 修改：`src/lib/schema/resume/form/skillSpecialty.ts`、`honorsCertificates.ts`、`hobbies.ts` — item 增加 `hidden`。
- 修改：`src/components/resume/runtime/renderers/*.tsx` — `.filter` 追加 `!hidden`。
- 修改：`src/components/resume/runtime/renderers/shared.tsx:221` — `RuntimeEntry` 全空返回 null。
- 修改：`supabase/functions/shared/resume-comment-core.ts` — 集合构建跳过 `hidden`。
- 修改：`src/store/resume/form.ts` — 新增 `toggleItemVisibility`。
- 修改：`src/pages/resume/editor/components/forms/shared/resume-field-form-section.tsx` — 眼睛按钮。
- 修改：技能/证书/爱好表单 — tag 上 hover 小眼睛。

### 需求② 变更记录重设计
- 创建：`src/pages/assistant/components/diff/field-labels.ts` — 字段名中文映射。
- 创建：`src/pages/assistant/components/diff/compute-field-diff.ts` — 字段级 diff。
- 创建：`src/pages/assistant/components/diff/field-diff-view.tsx` — 字段级渲染组件。
- 修改：`change-log/index.tsx`、`confirm-card/resume-field-diff.tsx`、`tool-call-part.tsx` — 换用字段级视图。
- 修改：变更记录数据模型/工具重试 — 批量操作、重做、失败重试。

---

## 阶段一：快速修 bug（④⑥）

### 任务 1：修复流式自动滚动失效（需求④）

**文件：**
- 修改：`src/components/ui/auto-scroll-container.tsx`（全文重写，68 行）

**根因：** 用"距底 30px"判断粘底。流式追加大块内容时程序化 `scrollTop = scrollHeight` 自身触发 scroll 事件，此刻可能又追加了内容使距底 > 30px，被误判为"用户已上滑"→ 停止跟随。

- [ ] **步骤 1：重写组件，改为用户意图检测**

将 `src/components/ui/auto-scroll-container.tsx` 全文替换为：

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface AutoScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  enabled?: boolean
  dependency?: any // 触发滚动的依赖项
  // 覆盖层渲染器：接收当前是否在底部与滚动到底方法，用于渲染"回到底部"按钮等
  renderOverlay?: (state: { atBottom: boolean, scrollToBottom: () => void }) => React.ReactNode
}

// 判定"是否已接近底部"的阈值：仅用于同步"回到底部"按钮与恢复跟随，不用于判断用户是否脱离
const BOTTOM_THRESHOLD = 30

export function AutoScrollContainer({
  children,
  className,
  enabled = true,
  dependency,
  renderOverlay,
  ...props
}: AutoScrollContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // followRef：是否处于"自动跟随底部"状态。只有用户主动向上滚动才会解除跟随。
  const followRef = useRef(true)
  // programmaticRef：标记正在进行程序化滚动，避免其触发的 scroll 事件被误判为用户操作
  const programmaticRef = useRef(false)
  const [atBottom, setAtBottom] = useState(true)

  const measureAtBottom = useCallback(() => {
    const el = containerRef.current
    if (!el)
      return true
    const { scrollTop, scrollHeight, clientHeight } = el
    return scrollHeight - scrollTop - clientHeight <= BOTTOM_THRESHOLD
  }, [])

  const scrollToBottomNow = useCallback((behavior: ScrollBehavior) => {
    const el = containerRef.current
    if (!el)
      return
    programmaticRef.current = true
    el.scrollTo({ top: el.scrollHeight, behavior })
    // 程序化滚动可能异步派发 scroll 事件，下一帧再解除标记
    requestAnimationFrame(() => {
      programmaticRef.current = false
    })
  }, [])

  const scrollToBottom = useCallback(() => {
    followRef.current = true
    setAtBottom(true)
    scrollToBottomNow('smooth')
  }, [scrollToBottomNow])

  // scroll 事件仅用于同步"回到底部"按钮显隐，不改变跟随状态（跟随只由用户 wheel/touch 意图决定）
  const handleScroll = useCallback(() => {
    if (programmaticRef.current)
      return
    setAtBottom(measureAtBottom())
  }, [measureAtBottom])

  // 用户主动上滚（滚轮上滚 / 触摸下拉）→ 解除跟随；滚回底部由 handleUserMaybeReturn 恢复
  const handleUserScrollIntent = useCallback((deltaUp: boolean) => {
    if (deltaUp) {
      followRef.current = false
    }
    else if (measureAtBottom()) {
      followRef.current = true
    }
    setAtBottom(measureAtBottom())
  }, [measureAtBottom])

  useEffect(() => {
    const el = containerRef.current
    if (!el)
      return
    const onWheel = (e: WheelEvent) => handleUserScrollIntent(e.deltaY < 0)
    let lastTouchY = 0
    const onTouchStart = (e: TouchEvent) => {
      lastTouchY = e.touches[0]?.clientY ?? 0
    }
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0
      handleUserScrollIntent(y > lastTouchY)
      lastTouchY = y
    }
    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
    }
  }, [handleUserScrollIntent])

  // 依赖变化（新增消息/流式追加）时，若仍处于跟随态就贴底
  useEffect(() => {
    if (enabled && followRef.current) {
      scrollToBottomNow('auto')
    }
  }, [dependency, enabled, scrollToBottomNow])

  // enabled 变为 true（新一轮流式开始）时重置为跟随
  useEffect(() => {
    if (enabled) {
      followRef.current = true
      setAtBottom(true)
    }
  }, [enabled])

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={containerRef}
        className={cn('overflow-auto', className)}
        onScroll={handleScroll}
        {...props}
      >
        {children}
      </div>
      {renderOverlay?.({ atBottom, scrollToBottom })}
    </div>
  )
}
```

- [ ] **步骤 2：构建校验**

运行：`pnpm exec tsc --noEmit`
预期：无新增类型错误。

- [ ] **步骤 3：手动验收**

运行：`pnpm dev`，打开 AI 助手发一条会长篇输出的消息。
预期：① 流式全程自动跟随到底；② 手动上滚立即暂停跟随并出现"回到底部"按钮；③ 手动滑回底部后恢复跟随；④ 切换会话滚动状态重置。

- [ ] **步骤 4：Commit**

```bash
git add src/components/ui/auto-scroll-container.tsx
git commit -m "$(cat <<'EOF'
fix(assistant): 修复流式输出中途停止自动滚动

- 自动滚动改为用户意图检测，程序化滚动不再被误判为用户上滑
- 监听 wheel/touch 判定主动脱离，滚回底部恢复跟随
EOF
)"
```

---

### 任务 2：简历条目 hidden 字段 + schema（需求⑥⑦ 数据层）

**文件：**
- 修改：`src/lib/schema/resume/form/shared.ts`
- 修改：`src/lib/schema/resume/form/skillSpecialty.ts:38-43`
- 修改：`src/lib/schema/resume/form/honorsCertificates.ts:20-23`
- 修改：`src/lib/schema/resume/form/hobbies.ts:21-24`

- [ ] **步骤 1：经历类 item 增加 `hidden` 字段**

修改 `src/lib/schema/resume/form/shared.ts`，把 `createExperienceSchema` 改为：

```ts
import { z } from 'zod'
import { resumeEntryIdSchema } from '../entry-id'

export const durationField = z.array(z.string().trim()).length(2)

// 条目级显隐：true = 隐藏（与板块级 visibility 语义一致），默认不隐藏
export const hiddenField = z.boolean().optional().default(false)

export function createExperienceSchema<T extends z.ZodRawShape>(fields: T) {
  return z.object({
    items: z.array(z.object({
      entryId: resumeEntryIdSchema,
      hidden: hiddenField,
      ...fields,
    })),
  })
}
```

- [ ] **步骤 2：技能/证书/爱好 item 增加 `hidden`**

`src/lib/schema/resume/form/skillSpecialty.ts` 的 `skillItemSchema`（38-43 行）改为：

```ts
export const skillItemSchema = z.object({
  entryId: resumeEntryIdSchema,
  hidden: z.boolean().optional().default(false),
  label: z.string().trim(),
  proficiencyLevel: proficiencyLevelEnum,
  displayType: displayTypeEnum,
})
```

`src/lib/schema/resume/form/honorsCertificates.ts` 的 `certificateItemSchema`（20-23 行）改为：

```ts
export const certificateItemSchema = z.object({
  entryId: resumeEntryIdSchema,
  hidden: z.boolean().optional().default(false),
  name: z.string().trim(),
})
```

`src/lib/schema/resume/form/hobbies.ts` 的 `hobbyItemSchema`（21-24 行）改为：

```ts
export const hobbyItemSchema = z.object({
  entryId: resumeEntryIdSchema,
  hidden: z.boolean().optional().default(false),
  name: z.string().trim(),
})
```

- [ ] **步骤 3：构建校验**

运行：`pnpm exec tsc --noEmit`
预期：无新增类型错误（`hidden` 为 optional，历史数据缺省视为 false，`normalizeResumeSection` 的 `mergeWithDefaults` 会保留已有数组元素）。

- [ ] **步骤 4：验证 AI 工具校验脚本仍通过**

运行：`pnpm run verify:ai-resume-tools`
预期：PASS（`hidden` 为可选，不破坏现有写入校验）。

- [ ] **步骤 5：Commit**

```bash
git add src/lib/schema/resume/form/
git commit -m "$(cat <<'EOF'
feat(resume-schema): 简历条目新增 hidden 显隐字段

- 经历类 items 与技能/证书/爱好 item 增加可选 hidden 字段
- 语义与板块级 visibility 一致：true 表示隐藏，默认不隐藏
EOF
)"
```

---

### 任务 3：渲染器过滤隐藏项 + 修复空行（需求⑥）

**文件：**
- 修改：`src/components/resume/runtime/renderers/shared.tsx:221-223`（`RuntimeEntry`）
- 修改：`src/components/resume/runtime/renderers/WorkExperienceRenderer.tsx:12-13`
- 修改：`InternshipExperienceRenderer.tsx`、`ProjectExperienceRenderer.tsx`、`CampusExperienceRenderer.tsx`、`EducationRenderer.tsx`（同样在 `.filter` 追加 `!item.hidden`）
- 修改：`SkillsRenderer.tsx:24`、`HonorsCertificatesRenderer.tsx`、`HobbiesRenderer.tsx`（标签类过滤 `!item.hidden`）

- [ ] **步骤 1：`RuntimeEntry` 全空返回 null**

修改 `src/components/resume/runtime/renderers/shared.tsx`，把第 221-223 行的：

```tsx
  if (!title) {
    return null
  }
```

改为（title/subtitle/duration/content 全为空则整条不渲染，消除空 flex 容器造成的空行）：

```tsx
  if (!title && !subtitle && !duration && !content) {
    return null
  }
```

> 说明：`title` 仍是主判据（无标题的经历通常无意义），但此前"title 存在、其余全空"或"title 空但被 filter 放行"两种断裂都可能产生空容器。保留 `!title` 单独早退在 `titleFieldKey` 缺节点时仍有效；改为全空判定可覆盖所有字段皆空的历史脏数据。若产品希望"无标题即不渲染"，保留原 `if (!title) return null` 于其后。此处采用"全空才隐藏 + 无标题仍渲染占位标题"的稳妥策略：最终判据为
> ```tsx
> if (!title && !subtitle && !duration && !content) {
>   return null
> }
> ```

- [ ] **步骤 2：经历类渲染器过滤 hidden**

`src/components/resume/runtime/renderers/WorkExperienceRenderer.tsx` 第 12-13 行改为：

```tsx
  const items = work_experience.items.filter(item =>
    !item.hidden
    && (item.companyName || item.position || item.workInfo || rangeHasValue(item.workDuration)))
```

对 `InternshipExperienceRenderer.tsx`、`ProjectExperienceRenderer.tsx`、`CampusExperienceRenderer.tsx`、`EducationRenderer.tsx` 做同构改动：各自 `.filter` 回调开头追加 `!item.hidden &&`（保留原有字段非空判断）。

> 实现前先 Read 每个渲染器确认其 filter 的字段名（如实习是 `internshipInfo`/`internshipDuration`，项目是 `projectName`/`participantRole`/`projectInfo`/`projectDuration`，校园是 `experienceName`/`role`/`campusInfo`，教育是 `schoolName`/`professional`/`eduInfo`）。

- [ ] **步骤 3：标签类渲染器过滤 hidden**

`src/components/resume/runtime/renderers/SkillsRenderer.tsx` 第 24 行的 `skill_specialty.skills.length > 0` 及其 `.map` 改为先过滤：

```tsx
{(() => {
  const visibleSkills = skill_specialty.skills.filter(s => !s.hidden)
  return visibleSkills.length > 0
    ? (
        <div className="flex flex-wrap gap-2">
          {visibleSkills.map(skill => (
            // …保持原 span 渲染不变
          ))}
        </div>
      )
    : null
})()}
```

对 `HonorsCertificatesRenderer.tsx`、`HobbiesRenderer.tsx` 做同构改动（先 Read 确认字段名 `certificates` / `hobbies`）。

- [ ] **步骤 4：构建校验**

运行：`pnpm exec tsc --noEmit && pnpm lint`
预期：无错误。

- [ ] **步骤 5：手动验收**

`pnpm dev`，在编辑器把某条经历所有字段清空 / 后续任务隐藏一条。
预期：预览与 PDF 中该条完全不占位，无空行。

- [ ] **步骤 6：Commit**

```bash
git add src/components/resume/runtime/renderers/
git commit -m "$(cat <<'EOF'
fix(resume-runtime): 隐藏项不再渲染空行

- RuntimeEntry 在标题/副标题/时间/描述全空时整体不渲染
- 各渲染器 filter 过滤 hidden 条目，从源头剔除不占位
EOF
)"
```

---

### 任务 4：评论核心跳过 hidden（需求⑥ 一致性）

**文件：**
- 修改：`supabase/functions/shared/resume-comment-core.ts:598`（`projectExperienceCollection`）

**背景：** 渲染器靠 `commentNodesByKey` 取节点（`RuntimeEntry` 用 `useCommentProjectionNode`）。若评论核心仍为 hidden 条目生成节点，会与渲染器 filter 不一致。

- [ ] **步骤 1：集合构建跳过 hidden 条目**

修改 `resume-comment-core.ts` 的 `projectExperienceCollection`，在 `readArray(entries).forEach((value, index) => {` 内、`const entry = readRecord(value)` 之后追加：

```ts
    if (entry.hidden === true) {
      return
    }
```

- [ ] **步骤 2：验证评论锚点脚本**

运行：`pnpm run verify:comments && pnpm run verify:comment-service`
预期：PASS。

- [ ] **步骤 3：Commit**

```bash
git add supabase/functions/shared/resume-comment-core.ts
git commit -m "$(cat <<'EOF'
fix(resume-comments): 评论锚点跳过隐藏条目

- 集合构建对 hidden 条目不生成节点，与渲染器过滤保持一致
EOF
)"
```

---

## 阶段二：AI 准确性与反馈（①⑤）

### 任务 5：简历 Schema 描述生成器（需求①）

**文件：**
- 创建：`src/lib/ai/schema-doc/build-schema-doc.ts`
- 创建：`src/lib/ai/schema-doc/index.ts`

**目标：** 从 `resumeSchema` 派生一段紧凑说明，重点标注对象数组、Duration 长度 2、所有枚举取值。避免引入 `zod-to-json-schema`（输出冗长）。

- [ ] **步骤 1：编写生成器**

创建 `src/lib/ai/schema-doc/build-schema-doc.ts`。实现前先 Read `src/lib/schema/resume/form/index.ts` 确认导出的 `resumeSchema` 与各 `DEFAULT_*`。采用"遍历 Zod `_def` + 针对本项目结构的手写描述"策略：

```ts
import type { ZodTypeAny } from 'zod'
import { resumeSchema } from '@/lib/schema'

const SECTION_LABELS: Record<string, string> = {
  basics: '基本信息',
  job_intent: '求职意向',
  application_info: '应聘信息',
  edu_background: '教育背景',
  work_experience: '工作经历',
  internship_experience: '实习经历',
  campus_experience: '校园经历',
  project_experience: '项目经历',
  skill_specialty: '技能特长',
  honors_certificates: '荣誉证书',
  self_evaluation: '自我评价',
  hobbies: '兴趣爱好',
}

// 解开 optional/default/nullable 包装，取到内部类型
function unwrap(schema: ZodTypeAny): ZodTypeAny {
  let cur: any = schema
  while (cur?._def && ['ZodOptional', 'ZodDefault', 'ZodNullable'].includes(cur._def.typeName)) {
    cur = cur._def.innerType
  }
  return cur
}

// 生成单个字段的类型描述字符串
function describeField(schema: ZodTypeAny): string {
  const t: any = unwrap(schema)
  const name = t?._def?.typeName
  switch (name) {
    case 'ZodString':
      return 'string'
    case 'ZodNumber':
      return 'number'
    case 'ZodBoolean':
      return 'boolean'
    case 'ZodEnum':
      return `enum(${(t._def.values as string[]).map(v => `"${v}"`).join(' | ')})`
    case 'ZodArray': {
      const el: any = unwrap(t._def.type ?? t._def.element)
      // 长度固定为 2 的字符串数组（各 Duration 字段）
      const exactLen = t._def.exactLength?.value ?? t._def.length?.value
      if (el?._def?.typeName === 'ZodString') {
        return exactLen === 2 ? 'string[]（长度固定为 2：[开始, 结束]）' : 'string[]'
      }
      if (el?._def?.typeName === 'ZodObject') {
        return `对象数组，元素结构：{ ${describeObjectShape(el)} }`
      }
      return 'array'
    }
    case 'ZodObject':
      return `对象：{ ${describeObjectShape(t)} }`
    default:
      return 'any'
  }
}

function describeObjectShape(objSchema: any): string {
  const shape = objSchema._def.shape?.() ?? objSchema.shape ?? {}
  return Object.entries(shape)
    .filter(([key]) => key !== 'entryId') // entryId 由系统生成，模型无需提供
    .map(([key, field]) => `${key}: ${describeField(field as ZodTypeAny)}`)
    .join('; ')
}

// 构建整份简历结构说明（供注入 system 上下文）
export function buildResumeSchemaDoc(): string {
  const shape: Record<string, ZodTypeAny> = (resumeSchema as any).shape ?? (resumeSchema as any)._def.shape()
  const lines: string[] = [
    '【简历模块字段结构（写入 update_current_resume_field 的 value 必须严格匹配）】',
    '重要约束：',
    '- 列表型字段（skills / certificates / hobbies / 各经历的 items / customFields）是【对象数组】，不是字符串数组，每个元素是带指定字段的对象。',
    '- 各时间字段（workDuration / internshipDuration / duration / projectDuration）是【长度固定为 2 的字符串数组】：[开始时间, 结束时间]。',
    '- enum 字段只能取列出的值之一。entryId 由系统自动生成，无需提供。',
    '',
  ]
  for (const [key, sectionSchema] of Object.entries(shape)) {
    const label = SECTION_LABELS[key] ?? key
    lines.push(`- ${key}（${label}）：${describeField(sectionSchema)}`)
  }
  return lines.join('\n')
}
```

> **实现注意：** Zod 4 的内部 `_def` 结构可能与上述假设不同（如 `typeName` 是否存在、`values` vs `entries`、`exactLength` 字段名）。实现时先写一个临时脚本 `node --experimental-strip-types` 打印 `resumeSchema` 某个模块的 `_def` 结构核对，再据实调整 `unwrap`/`describeField` 的判定。目标产物是稳定、可读、覆盖三类约束的文本，不追求覆盖 Zod 全部特性。

- [ ] **步骤 2：barrel + memo 缓存**

创建 `src/lib/ai/schema-doc/index.ts`：

```ts
import { buildResumeSchemaDoc } from './build-schema-doc'

let cached: string | null = null

// schema 静态，进程内构建一次即可
export function getResumeSchemaDoc(): string {
  if (cached == null)
    cached = buildResumeSchemaDoc()
  return cached
}
```

- [ ] **步骤 3：临时核对生成结果**

写临时脚本 `scripts/tmp-print-schema-doc.ts`：`import { getResumeSchemaDoc } from '../src/lib/ai/schema-doc'; console.log(getResumeSchemaDoc())`，运行 `node --experimental-strip-types scripts/tmp-print-schema-doc.ts`。
预期输出：能看到 `skill_specialty` 的 `skills` 标为对象数组且列出 `label / proficiencyLevel: enum("一般"|...) / displayType: enum("text"|"percentage")`；`work_experience.items` 的 `workDuration` 标为"长度固定为 2"；`basics` 的 `workYears` 列出枚举。核对无误后删除临时脚本。

- [ ] **步骤 4：Commit**

```bash
git add src/lib/ai/schema-doc/
git commit -m "$(cat <<'EOF'
feat(ai): 新增从 Zod 派生的简历结构说明生成器

- 遍历 resumeSchema 生成紧凑字段结构文本，随 schema 自动同步
- 重点标注对象数组、长度固定 Duration、枚举取值三类约束
EOF
)"
```

---

### 任务 6：注入 Schema 到 AI 上下文（需求①）

**文件：**
- 修改：`src/lib/ai/agent/build-context.ts:68`
- 修改：`src/lib/ai/tools/resume.ts:81`

- [ ] **步骤 1：build-context 注入结构说明**

在 `src/lib/ai/agent/build-context.ts` 顶部加导入：

```ts
import { getResumeSchemaDoc } from '@/lib/ai/schema-doc'
```

在第 68 行 `lines.push('你可调用工具完整读写用户数据…')` 之后、`return lines.join('\n')` 之前追加：

```ts
  lines.push('')
  lines.push(getResumeSchemaDoc())
```

- [ ] **步骤 2：精简强化工具描述**

修改 `src/lib/ai/tools/resume.ts` 第 81 行 `update_current_resume_field` 的 `description`，改为：

```ts
  description: `修改「当前正在编辑」的简历的某个模块内容。仅当用户已在编辑器打开某份简历时可用。sectionKey 可选值：${FORM_DATA_KEYS.join(', ')}。value 为该模块的新内容对象，其字段结构必须严格匹配 system 中「简历模块字段结构」的说明（特别注意：列表字段是对象数组而非字符串数组；时间字段是长度为 2 的字符串数组；enum 只能取给定值）。此操作需用户确认。`,
```

- [ ] **步骤 3：构建校验**

运行：`pnpm exec tsc --noEmit && pnpm lint`
预期：无错误。

- [ ] **步骤 4：手动验收**

`pnpm dev`，让 AI 一次性填充/修改包含技能、工作经历的简历。
预期：不再出现"对象数组 vs 字符串数组""缺 label/proficiencyLevel/displayType""需要 internshipDuration"等结构类拒绝重试；skills/experience items 一次写对。

- [ ] **步骤 5：Commit**

```bash
git add src/lib/ai/agent/build-context.ts src/lib/ai/tools/resume.ts
git commit -m "$(cat <<'EOF'
feat(ai): 向对话上下文注入简历字段结构说明

- build-context 追加简历模块 schema 说明，模型写入前即知结构
- 强化 update_current_resume_field 工具描述指向结构约束
EOF
)"
```

---

### 任务 7：工具调用即时反馈（需求⑤）

**文件：**
- 修改：`src/lib/ai/agent/stream-parser.ts`
- 修改：`src/lib/ai/agent/agent-loop.ts:11-18`（`AgentCallbacks`）、`:61-65`（流循环）
- 修改：`src/pages/assistant/hooks/use-chat-stream.ts:130-157`

- [ ] **步骤 1：StreamParser 暴露进行中工具快照**

在 `src/lib/ai/agent/stream-parser.ts` 的 `StreamParser` 类内新增方法（`result()` 之前）：

```ts
  // 进行中的工具调用快照（按 index 排序，返回已到达的 id/name，供流式期间即时上屏）
  pendingToolCalls(): Array<{ index: number, id: string, name: string }> {
    return [...this.toolAcc.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([index, v]) => ({ index, id: v.id, name: v.name }))
  }
```

- [ ] **步骤 2：AgentCallbacks 增加 onToolCallPending**

`src/lib/ai/agent/agent-loop.ts` 的 `AgentCallbacks`（11-18 行）增加一个可选回调：

```ts
export interface AgentCallbacks {
  onReasoning?: (full: string) => void
  onText?: (full: string) => void
  // 流式期间：一旦解析出工具函数名即触发（每个工具仅首次触发一次），用于即时上屏 pending 轨迹行
  onToolCallPending?: (call: { id: string, name: string }) => void
  onToolCallStart?: (call: { id: string, name: string, args: Record<string, unknown>, awaitingConfirm?: boolean }) => void
  onToolResult?: (id: string, result: unknown, isError: boolean, cancelled?: boolean) => void
  onUsage?: (usage: StreamUsage) => void
}
```

- [ ] **步骤 3：流循环内触发 pending**

修改 `agent-loop.ts` 的 `for await` 循环（61-65 行），在 `parser.push(chunk)` 后检测新工具名：

```ts
      const seenPendingTools = new Set<string>()
      for await (const chunk of stream) {
        if (signal.aborted)
          throw new DOMException('aborted', 'AbortError')
        parser.push(chunk)
        // 工具名一旦到达即上屏（id 可能稍晚，用 index 兜底 key）
        for (const p of parser.pendingToolCalls()) {
          const key = p.id || `idx-${p.index}`
          if (p.name && !seenPendingTools.has(key)) {
            seenPendingTools.add(key)
            callbacks.onToolCallPending?.({ id: p.id || key, name: p.name })
          }
        }
      }
```

> 注意：`seenPendingTools` 声明在 `for await` 之前、`try` 之内。确保 `onToolCallStart`（104 行）后续用真实 `tc.id` 更新同一行——见步骤 4 的 UI 侧按"最近一个 pending 且未定型工具行"对齐。

- [ ] **步骤 4：UI 侧 pending 即上屏转圈行**

修改 `src/pages/assistant/hooks/use-chat-stream.ts`，在 `callbacks` 对象内（`onToolCallStart` 之前）新增：

```ts
          onToolCallPending: (call) => {
            // 已存在同名未定型（state==='call' 且无 args）的行则跳过，避免重复
            const exists = draft.some(p => p.type === 'tool-call' && p.toolCallId === call.id)
            if (!exists) {
              draft.push({ type: 'tool-call', toolCallId: call.id, toolName: call.name, args: {}, state: 'call' })
              textIdx = -1
              reasoningIdx = -1
              pushDraft()
            }
          },
```

并修改现有 `onToolCallStart`（151-157 行），改为"若已存在同 id 的 pending 行则原地更新，否则新增"：

```ts
          onToolCallStart: (call) => {
            const i = draft.findIndex(p => p.type === 'tool-call' && p.toolCallId === call.id)
            const next = { type: 'tool-call' as const, toolCallId: call.id, toolName: call.name, args: call.args, state: call.awaitingConfirm ? 'awaiting-confirm' as const : 'call' as const }
            if (i >= 0)
              draft[i] = next
            else
              draft.push(next)
            textIdx = -1
            reasoningIdx = -1
            pushDraft()
          },
```

> **id 一致性风险：** DeepSeek 流式分片中 `tool_calls[].id` 通常在首个分片即到达。若某些情况下 pending 阶段 id 为空而用了 `idx-N` 兜底 key，`onToolCallStart` 用真实 id 会 findIndex 不中而新增重复行。缓解：pending 仅在 `p.id` 非空时上屏（把步骤 3 的条件改为 `if (p.name && p.id && !seenPendingTools.has(p.id))`）。实现时优先采用"仅 id 就绪才上屏"，牺牲极少数无 id 场景的提前量换取无重复。

- [ ] **步骤 5：构建校验**

运行：`pnpm exec tsc --noEmit && pnpm lint`
预期：无错误。

- [ ] **步骤 6：手动验收**

`pnpm dev`，让 AI 执行一次"修改简历"。
预期：模型决定调用工具后，"修改简历"转圈轨迹行几乎立即出现，而非等数秒；参数补全/确认后状态正确切换为等待确认/已应用/失败。

- [ ] **步骤 7：Commit**

```bash
git add src/lib/ai/agent/stream-parser.ts src/lib/ai/agent/agent-loop.ts src/pages/assistant/hooks/use-chat-stream.ts
git commit -m "$(cat <<'EOF'
feat(assistant): 工具调用即时上屏反馈

- StreamParser 暴露进行中工具快照，流式期间解析出工具名即触发 pending
- 对话流立即渲染转圈的修改简历轨迹行，消除调用初期无反应的卡顿感
EOF
)"
```

---

## 阶段三：条目级隐藏交互（⑦）

### 任务 8：store 新增 toggleItemVisibility（需求⑦ 状态层）

**文件：**
- 修改：`src/store/resume/form.ts`

**背景：** 条目增删改走 react-hook-form 的 `useFieldArray` + `useResumeFormSync` 同步回 store。隐藏切换是一次字段级更新，需走 `updateFormFields` 管线以保证协作同步。实现前先 Read `src/hooks/collab/use-resume-form-sync.ts` 与 `src/hooks/collab/write-plan.ts` 确认 `WriteOp` 构造方式。

- [ ] **步骤 1：确认写操作构造**

Read `src/hooks/collab/write-plan.ts`（`WriteOp` 类型与构造工具），确认如何为"`work_experience.items[3].hidden = true`"这类嵌套路径生成 `WriteOp`。

- [ ] **步骤 2：优先在表单层实现切换（推荐）**

条目隐藏本质是修改某个 item 的 `hidden` 字段——与编辑标题等字段同属表单编辑。因此**优先复用现有表单编辑管线**：在编辑器条目 UI（任务 9）里直接 `form.setValue(\`items.${index}.hidden\`, next)`，由 `useResumeFormSync` 自动生成 `WriteOp` 同步。若此路径可行，则**本任务无需在 store 新增 action**，只需确认 `useResumeFormSync` 会把 `hidden` 变更纳入同步（Read 确认其是否按整表 diff 生成 ops；schema 已含 hidden 即会覆盖）。

- [ ] **步骤 3：标签类（技能/证书/爱好）切换**

技能/证书/爱好同样由各自表单的 `useFieldArray` 管理，隐藏切换用 `form.setValue(\`skills.${index}.hidden\`, next)`（对应字段名）。确认其表单也接入了 `useResumeFormSync`。

- [ ] **步骤 4：结论记录**

若表单层 `setValue` 即可覆盖全部隐藏切换且正确同步，则本任务标记为"无需 store 改动，切换在任务 9 的 UI 层用 setValue 实现"，直接进入任务 9。若 `useResumeFormSync` 不覆盖 `hidden`（例如它显式挑选字段同步），则在 `form.ts` 仿照 `toggleVisibility`（188-199 行）新增：

```ts
  toggleItemVisibility: (key, entryId) => {
    const section = get()[key] as { items?: Array<{ entryId: string, hidden?: boolean }> }
    const items = section?.items ?? []
    const nextItems = items.map(it => it.entryId === entryId ? { ...it, hidden: !it.hidden } : it)
    const nextValue = { ...section, items: nextItems }
    // 复用 updateFormFields：需构造对应 WriteOp（见步骤 1 确认的构造方式）
    get().updateFormFields(key as any, nextValue as any, buildHiddenWriteOps(key, entryId, /* next */))
  },
```

并在 `FormSlice` interface（25-39 行区）补类型声明。是否需要此 action 由步骤 2/3 的实测决定，避免冗余。

- [ ] **步骤 5：Commit（若有 store 改动）**

```bash
git add src/store/resume/form.ts
git commit -m "$(cat <<'EOF'
feat(resume-store): 支持条目级显隐切换

- 新增 toggleItemVisibility，经字段级写操作管线保证协作同步
EOF
)"
```

---

### 任务 9：编辑器条目隐藏按钮（需求⑦ UI 层）

**文件：**
- 修改：`src/pages/resume/editor/components/forms/shared/resume-field-form-section.tsx`
- 修改：技能表单 `src/pages/resume/editor/components/forms/skill-specialty/index.tsx:179-190`
- 修改：证书、爱好表单（结构类似技能）

**前置：** 实现前 Read `resume-field-form-section.tsx` 的调用方（各经历表单），确认 `renderItem`/`form` 能拿到 `index`，以便 `form.setValue(\`items.${index}.hidden\`, next)`。当前该组件签名未透出每项 `hidden` 值，需要新增读取。

- [ ] **步骤 1：经历类条目头部加眼睛按钮**

在 `resume-field-form-section.tsx` 引入图标：

```tsx
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
```

在删除按钮（90-99 行）之前插入眼睛切换按钮。用 `form.watch` 读取当前项 hidden：

```tsx
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            const path = `items.${index}.hidden` as const
                            form.setValue(path as any, !form.getValues(path as any), { shouldDirty: true })
                          }}
                          aria-label={`${form.getValues(`items.${index}.hidden` as any) ? '显示' : '隐藏'}${title}#${index + 1}`}
                        >
                          {form.getValues(`items.${index}.hidden` as any)
                            ? <EyeOff className="size-4" />
                            : <Eye className="size-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {form.getValues(`items.${index}.hidden` as any) ? '显示此项' : '隐藏此项（内容保留）'}
                      </TooltipContent>
                    </Tooltip>
```

> 注意：眼睛按钮对单条也应可用（不像上移/下移只在 `multiple` 时显示）。可将其移出 `multiple &&` 条件块，单独渲染在按钮组内；相应调整第 54 行 `{multiple && (` 的结构，使按钮组容器始终渲染、仅上移/下移/删除受 `multiple` 约束。

- [ ] **步骤 2：隐藏项置灰半透明**

在条目容器（`resume-field-form-section.tsx` 第 48 行 `<div className="flex flex-col gap-4">`）根据 hidden 加样式：

```tsx
            <div className={cn('flex flex-col gap-4', form.getValues(`items.${index}.hidden` as any) && 'opacity-50')}>
```

> 用 `form.watch(\`items.${index}.hidden\`)` 替代 `getValues` 以便切换即时重渲染（`watch` 订阅变化）。实现时统一用 `const hidden = form.watch(\`items.${index}.hidden\` as any)` 提到 map 回调顶部，复用于 aria/图标/样式。

- [ ] **步骤 3：技能/证书/爱好标签 hover 小眼睛**

Read `skill-specialty/index.tsx` 确认标签渲染结构（179-190 行为卡片头部删除按钮；技能标签列表在别处）。在每个技能标签容器加 `group relative`，hover 显示右上角小眼睛按钮切换 `form.setValue(\`skills.${index}.hidden\`, next)`；隐藏的标签 `opacity-50`。证书、爱好同构（字段名 `certificates` / `hobbies`）。

- [ ] **步骤 4：构建校验**

运行：`pnpm exec tsc --noEmit && pnpm lint`
预期：无错误。

- [ ] **步骤 5：手动验收**

`pnpm dev`，编辑器中点击某经历的眼睛按钮。
预期：① 该条目置灰半透明、内容仍在且可编辑；② 预览/PDF 中该条不显示、不占空行；③ 再次点击恢复显示；④ 技能/证书/爱好标签 hover 出现小眼睛，可隐藏单个标签。

- [ ] **步骤 6：Commit**

```bash
git add src/pages/resume/editor/components/forms/
git commit -m "$(cat <<'EOF'
feat(editor): 新增条目级隐藏按钮

- 经历类条目头部加眼睛按钮，隐藏后置灰半透明、内容保留可编辑
- 技能/证书/爱好标签 hover 显示小眼睛切换单项显隐
EOF
)"
```

---

## 阶段四：对话分页加载（③）

### 任务 10：listMessages 支持游标分页（需求③ 数据层）

**文件：**
- 修改：`src/lib/supabase/ai/messages.ts:16-31`

- [ ] **步骤 1：改造 listMessages**

将 `listMessages` 改为支持"取最新 N 条 + before 游标向上翻页"，返回升序数组与 `hasMore`：

```ts
export interface ListMessagesResult {
  messages: AiMessage[]
  hasMore: boolean
}

// 默认取最新 limit 条（按 created_at 倒序取后在内存 reverse 为升序）；
// before 为已加载最早消息的 created_at，用于向上加载更早的历史。
export async function listMessages(
  conversationId: string,
  options: { limit?: number, before?: string } = {},
): Promise<ListMessagesResult> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const limit = options.limit ?? 30
  let query = supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit + 1) // 多取一条判断是否还有更早的

  if (options.before)
    query = query.lt('created_at', options.before)

  const { data, error } = await query
  if (error)
    throw error

  const rows = data || []
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  // 倒序取回后 reverse 成升序（旧 → 新）
  const messages = page.map(mapMessage).reverse()
  return { messages, hasMore }
}
```

> **游标注意：** 同一毫秒多条消息时 `created_at` 可能相同导致漏取/重复。缓解：`before` 用严格 `<` 且以 `id` 作二级排序。若 `created_at` 精度不足，改用 `.order('created_at', {ascending:false}).order('id', {ascending:false})` 并把游标改为 `(created_at, id)` 复合。实现时先确认 `ai_messages.created_at` 精度（Read migration）；若为 `timestamptz` 微秒级则单列游标足够。

- [ ] **步骤 2：全局检索 listMessages 调用点并适配**

运行：`grep -rn "listMessages" src/`，将所有调用改为解构 `{ messages, hasMore }`。主要在 `use-assistant-bootstrap.ts`、`use-assistant-navigation.ts`。

- [ ] **步骤 3：构建校验**

运行：`pnpm exec tsc --noEmit`
预期：报出所有旧调用点类型错误（返回值由数组变对象），逐一在任务 11/12 修正。

- [ ] **步骤 4：Commit**

```bash
git add src/lib/supabase/ai/messages.ts
git commit -m "$(cat <<'EOF'
feat(assistant): listMessages 支持游标分页

- 默认取最新 30 条，before 游标向上加载更早历史，返回 hasMore
EOF
)"
```

---

### 任务 11：分页状态与加载动作（需求③ 状态层）

**文件：**
- 修改：`src/pages/assistant/store.ts`
- 修改：`src/pages/assistant/hooks/use-assistant-navigation.ts:42-92`
- 修改：`src/pages/assistant/hooks/use-assistant-bootstrap.ts:12-82`

**前置：** Read `store.ts` 确认 `setConversationView` 签名与 `messages` 状态字段，Read 两个 hook 确认现有 `listMessages` 调用。

- [ ] **步骤 1：store 增加分页状态与动作**

在 `useAssistantStore` 状态中增加：

```ts
  hasMoreMessages: boolean // 当前会话是否还有更早消息
  loadingOlder: boolean
  oldestMessageCursor: string | null // 已加载最早消息的 created_at
```

新增动作：

```ts
  // 会话首屏视图（分页版）：设置最新一页 + 游标 + hasMore
  setConversationView: (conversationId, messages, hasMore) => set({
    activeConversationId: conversationId,
    messages,
    hasMoreMessages: hasMore,
    oldestMessageCursor: messages[0]?.createdAt ?? null,
    loadingMessages: false,
    loadingOlder: false,
    conversationViewVersion: get().conversationViewVersion + 1,
  }),

  // 顶部前插更早消息
  prependOlderMessages: (older, hasMore) => set(state => ({
    messages: [...older, ...state.messages],
    hasMoreMessages: hasMore,
    oldestMessageCursor: older[0]?.createdAt ?? state.oldestMessageCursor,
    loadingOlder: false,
  })),

  setLoadingOlder: (v: boolean) => set({ loadingOlder: v }),
```

> 实现时对齐现有 `setConversationView` 的既有签名（Read 确认它当前是否已有 `messages` 参数）；若签名变更，同步改所有调用点。

- [ ] **步骤 2：bootstrap 与 navigation 首屏拉最新页**

`use-assistant-bootstrap.ts` 与 `use-assistant-navigation.ts` 中 `const msgs = await listMessages(id)` 改为：

```ts
const { messages, hasMore } = await listMessages(id, { limit: 30 })
```

并把 `setConversationView(id, ...)` 调用传入 `messages, hasMore`（对齐步骤 1 签名）。保留 `conversationLoadRequestId` 竞态保护。

- [ ] **步骤 3：新增"加载更早"动作 hook**

在 `use-assistant-navigation.ts` 导出 `loadOlderMessages`：

```ts
const loadOlderMessages = useCallback(async () => {
  const s = useAssistantStore.getState()
  if (s.loadingOlder || !s.hasMoreMessages || !s.activeConversationId || !s.oldestMessageCursor)
    return
  useAssistantStore.getState().setLoadingOlder(true)
  const convId = s.activeConversationId
  try {
    const { messages, hasMore } = await listMessages(convId, { limit: 30, before: s.oldestMessageCursor })
    if (useAssistantStore.getState().activeConversationId !== convId)
      return
    useAssistantStore.getState().prependOlderMessages(messages, hasMore)
  }
  catch {
    useAssistantStore.getState().setLoadingOlder(false)
  }
}, [])
```

- [ ] **步骤 4：构建校验**

运行：`pnpm exec tsc --noEmit`
预期：无错误（旧 listMessages 调用已全部适配）。

- [ ] **步骤 5：Commit**

```bash
git add src/pages/assistant/store.ts src/pages/assistant/hooks/use-assistant-navigation.ts src/pages/assistant/hooks/use-assistant-bootstrap.ts
git commit -m "$(cat <<'EOF'
feat(assistant): 对话消息分页状态与加载动作

- store 增加 hasMore/oldestCursor/loadingOlder 与前插动作
- 首屏只拉最新一页，新增 loadOlderMessages 向上翻页
EOF
)"
```

---

### 任务 12：消息列表顶部加载更早 + 滚动补偿（需求③ UI 层）

**文件：**
- 修改：`src/pages/assistant/components/message-list/index.tsx`

- [ ] **步骤 1：顶部哨兵 + IntersectionObserver + 滚动补偿**

在 `message-list/index.tsx` 消息容器顶部（第 100 行 `<div className="mx-auto …">` 内、`messages.map` 之前）加一个哨兵与"加载更早"逻辑。滚动补偿：前插前记录 `scrollHeight`，前插后把 `scrollTop` 增加高度差。

```tsx
// 顶部哨兵：进入视口即加载更早消息，并补偿滚动位置避免视口跳动
const { loadOlderMessages } = useChatStream() // 或 use-assistant-navigation 导出的实例
const topSentinelRef = useRef<HTMLDivElement>(null)
const scrollRootRef = useRef<HTMLElement | null>(null)
const { hasMoreMessages, loadingOlder } = useAssistantStore()

useEffect(() => {
  const sentinel = topSentinelRef.current
  if (!sentinel || !hasMoreMessages)
    return
  const root = sentinel.closest('.overflow-auto') as HTMLElement | null
  scrollRootRef.current = root
  const io = new IntersectionObserver(async (entries) => {
    if (!entries[0].isIntersecting || loadingOlder || !hasMoreMessages)
      return
    const before = root?.scrollHeight ?? 0
    await loadOlderMessages()
    requestAnimationFrame(() => {
      if (root) {
        const after = root.scrollHeight
        root.scrollTop += after - before
      }
    })
  }, { root, threshold: 0.1 })
  io.observe(sentinel)
  return () => io.disconnect()
}, [hasMoreMessages, loadingOlder, loadOlderMessages])
```

在 `messages.map` 之前插入哨兵与加载指示：

```tsx
{hasMoreMessages && (
  <div ref={topSentinelRef} className="flex justify-center py-2">
    {loadingOlder && <Skeleton className="h-4 w-24 rounded-full" />}
  </div>
)}
```

> **实现注意：** `loadOlderMessages` 应从统一 hook 暴露。当前 `use-chat-stream` 不含它——按任务 11 放在 `use-assistant-navigation`。若 message-list 未使用该 hook，则在此 import。确认 `AutoScrollContainer` 内层滚动元素类名为 `overflow-auto`（见任务 1 组件）；用 `closest('.overflow-auto')` 获取滚动根，或给 AutoScrollContainer 透出 ref 更稳妥（可选增强）。

- [ ] **步骤 2：构建校验**

运行：`pnpm exec tsc --noEmit && pnpm lint`
预期：无错误。

- [ ] **步骤 3：手动验收**

准备一个消息很多（> 60 条）的会话，`pnpm dev` 打开。
预期：① 首屏只渲染最新约 30 条、秒开；② 向上滚动到顶触发加载更早，视口不跳动；③ 加载到最早后不再请求；④ 新发消息仍自动贴底（与任务 1 协同）。

- [ ] **步骤 4：Commit**

```bash
git add src/pages/assistant/components/message-list/index.tsx
git commit -m "$(cat <<'EOF'
feat(assistant): 消息列表向上分页加载

- 顶部哨兵触发加载更早消息，前插时补偿 scrollTop 避免视口跳动
EOF
)"
```

---

## 阶段五：变更记录重设计（②）

### 任务 13：字段名中文映射（需求②a 基础）

**文件：**
- 创建：`src/pages/assistant/components/diff/field-labels.ts`

- [ ] **步骤 1：编写映射表**

创建 `field-labels.ts`，覆盖各模块字段中文名（Read 各表单 label 与 `SECTION_LABELS` 对齐）：

```ts
// 简历各模块字段的中文名，用于变更记录字段级对比展示
export const SECTION_LABELS: Record<string, string> = {
  basics: '基本信息',
  job_intent: '求职意向',
  application_info: '应聘信息',
  edu_background: '教育背景',
  work_experience: '工作经历',
  internship_experience: '实习经历',
  campus_experience: '校园经历',
  project_experience: '项目经历',
  skill_specialty: '技能特长',
  honors_certificates: '荣誉证书',
  self_evaluation: '自我评价',
  hobbies: '兴趣爱好',
}

// 字段名 → 中文（跨模块合并；同名字段语义一致）
export const FIELD_LABELS: Record<string, string> = {
  name: '姓名',
  gender: '性别',
  phone: '电话',
  email: '邮箱',
  workYears: '工作年限',
  companyName: '公司名称',
  position: '职位',
  workInfo: '工作内容',
  workDuration: '在职时间',
  internshipInfo: '实习内容',
  internshipDuration: '实习时间',
  projectName: '项目名称',
  participantRole: '担任角色',
  projectInfo: '项目描述',
  projectDuration: '项目时间',
  experienceName: '经历名称',
  role: '角色',
  campusInfo: '经历描述',
  schoolName: '学校',
  professional: '专业',
  degree: '学历',
  eduInfo: '教育描述',
  duration: '时间',
  description: '描述',
  label: '技能',
  proficiencyLevel: '熟练度',
  name_certificate: '证书名称',
  content: '内容',
  jobIntent: '求职意向',
  intentionalCity: '意向城市',
  expectedSalary: '期望薪资',
  dateEntry: '到岗时间',
  // …实现时补全其余字段
}

// 不展示给用户的技术字段
export const HIDDEN_DIFF_FIELDS = new Set(['entryId', 'hidden', 'displayType'])

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/pages/assistant/components/diff/field-labels.ts
git commit -m "$(cat <<'EOF'
feat(assistant): 新增变更记录字段中文名映射

- 集中管理模块与字段中文标签，隐藏 entryId/hidden 等技术字段
EOF
)"
```

---

### 任务 14：字段级 diff 计算（需求②a 核心）

**文件：**
- 创建：`src/pages/assistant/components/diff/compute-field-diff.ts`

- [ ] **步骤 1：实现字段级 diff**

创建 `compute-field-diff.ts`：对比 before/after 对象，输出中文字段变更列表；items 数组按 entryId 配对逐条对比：

```ts
import { fieldLabel, HIDDEN_DIFF_FIELDS } from './field-labels'

export interface FieldChange {
  path: string // 展示用路径，如 "工作经历 #1 · 公司名称"
  label: string
  kind: 'added' | 'removed' | 'changed'
  before: string
  after: string
}

const EMPTY = '（空）'

// 归一化值为可读字符串（对象/数组/富文本简化）
function toDisplay(value: unknown): string {
  if (value == null || value === '')
    return EMPTY
  if (typeof value === 'string') {
    // 去 HTML 标签，避免富文本原样展示
    const text = value.replace(/<[^>]+>/g, '').trim()
    return text || EMPTY
  }
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (Array.isArray(value)) {
    if (value.every(v => typeof v === 'string'))
      return value.filter(Boolean).join(' ~ ') || EMPTY
    return `${value.length} 项`
  }
  return JSON.stringify(value)
}

function diffScalar(label: string, path: string, before: unknown, after: unknown, out: FieldChange[]): void {
  const b = toDisplay(before)
  const a = toDisplay(after)
  if (b === a)
    return
  out.push({
    path,
    label,
    kind: b === EMPTY ? 'added' : a === EMPTY ? 'removed' : 'changed',
    before: b,
    after: a,
  })
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// 对比一个对象的标量字段（跳过技术字段与数组/对象，数组单独处理）
function diffObjectScalars(sectionLabel: string, prefix: string, before: unknown, after: unknown, out: FieldChange[]): void {
  const b = isRecord(before) ? before : {}
  const a = isRecord(after) ? after : {}
  const keys = new Set([...Object.keys(b), ...Object.keys(a)])
  for (const key of keys) {
    if (HIDDEN_DIFF_FIELDS.has(key))
      continue
    if (Array.isArray(a[key]) || Array.isArray(b[key]) || isRecord(a[key]) || isRecord(b[key]))
      continue
    const label = fieldLabel(key)
    diffScalar(label, prefix ? `${prefix} · ${label}` : `${sectionLabel} · ${label}`, b[key], a[key], out)
  }
}

// 对比 items 型集合（按 entryId 配对）
function diffItems(sectionLabel: string, itemLabel: string, before: unknown, after: unknown, out: FieldChange[]): void {
  const bItems = (isRecord(before) && Array.isArray(before.items) ? before.items : []) as Array<Record<string, unknown>>
  const aItems = (isRecord(after) && Array.isArray(after.items) ? after.items : []) as Array<Record<string, unknown>>
  const bMap = new Map(bItems.map(it => [String(it.entryId), it]))
  const aMap = new Map(aItems.map(it => [String(it.entryId), it]))
  const allIds = [...new Set([...bMap.keys(), ...aMap.keys()])]
  allIds.forEach((id) => {
    const idx = aItems.findIndex(it => String(it.entryId) === id)
    const ordinal = idx >= 0 ? idx + 1 : bItems.findIndex(it => String(it.entryId) === id) + 1
    diffObjectScalars(sectionLabel, `${sectionLabel} #${ordinal}`, bMap.get(id), aMap.get(id), out)
  })
}

// 顶层入口：根据 sectionKey 结构选择对比策略
export function computeFieldDiff(sectionLabel: string, before: unknown, after: unknown): FieldChange[] {
  const out: FieldChange[] = []
  const hasItems = (isRecord(before) && Array.isArray(before.items)) || (isRecord(after) && Array.isArray(after.items))
  if (hasItems) {
    diffItems(sectionLabel, sectionLabel, before, after, out)
    // items 同级的标量字段（如无）也对比
  }
  else {
    diffObjectScalars(sectionLabel, '', before, after, out)
    // skills/certificates/hobbies 等对象数组字段：逐个集合对比
    const b = isRecord(before) ? before : {}
    const a = isRecord(after) ? after : {}
    for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (Array.isArray(a[key]) || Array.isArray(b[key])) {
        const bArr = (Array.isArray(b[key]) ? b[key] : []) as Array<Record<string, unknown>>
        const aArr = (Array.isArray(a[key]) ? a[key] : []) as Array<Record<string, unknown>>
        if (bArr.every(x => typeof x === 'string') && aArr.every(x => typeof x === 'string'))
          continue // 字符串数组已在 scalar 分支按整体对比
        const bMap = new Map(bArr.map(it => [String(it.entryId), it]))
        const aMap = new Map(aArr.map(it => [String(it.entryId), it]))
        const label = fieldLabel(key)
        ;[...new Set([...bMap.keys(), ...aMap.keys()])].forEach((id, i) => {
          diffObjectScalars(label, `${label} #${i + 1}`, bMap.get(id), aMap.get(id), out)
        })
      }
    }
  }
  return out
}
```

> **实现注意：** 上述覆盖三种结构：① 单例对象（basics/job_intent/self_evaluation）；② `{items:[]}` 经历类；③ `{description, skills/certificates/hobbies:[]}` 标签类。实现后用几组真实 before/after（从任务 6 手动测试的工具调用里取）核对输出的中文路径与增删改判定正确。

- [ ] **步骤 2：构建校验**

运行：`pnpm exec tsc --noEmit`
预期：无错误。

- [ ] **步骤 3：Commit**

```bash
git add src/pages/assistant/components/diff/compute-field-diff.ts
git commit -m "$(cat <<'EOF'
feat(assistant): 新增字段级中文变更对比计算

- 对比 before/after 输出中文字段增删改，items 按 entryId 配对
- 富文本去标签、空值显示为（空），隐藏技术字段
EOF
)"
```

---

### 任务 15：字段级 diff 视图组件（需求②a 展示）

**文件：**
- 创建：`src/pages/assistant/components/diff/field-diff-view.tsx`
- 修改：`src/pages/assistant/components/confirm-card/resume-field-diff.tsx`
- 修改：`src/pages/assistant/components/assistant-canvas/change-log/index.tsx:108-112`

**前置：** Read `confirm-card/resume-field-diff.tsx` 与 `change-log` 的 `CanvasChange` 类型（含 `detail.before/after` 与 `sectionKey`），确认能拿到 sectionKey 以映射中文名。

- [ ] **步骤 1：编写 FieldDiffView**

创建 `field-diff-view.tsx`：

```tsx
import type { FieldChange } from './compute-field-diff'
import { ArrowRight } from 'lucide-react'
import { computeFieldDiff } from './compute-field-diff'
import { SECTION_LABELS } from './field-labels'

export function FieldDiffView({ sectionKey, before, after }: { sectionKey: string, before: unknown, after: unknown }) {
  const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey
  const changes = computeFieldDiff(sectionLabel, before, after)

  if (changes.length === 0)
    return <p className="text-muted-foreground">无字段变更</p>

  return (
    <ul className="flex flex-col gap-2">
      {changes.map(c => (
        <li key={`${c.path}-${c.kind}`} className="rounded-md border bg-muted/30 p-2 text-xs">
          <div className="mb-1 font-medium text-foreground">{c.path}</div>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-rose-600 line-through decoration-rose-300">
              {c.before}
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-emerald-600">
              {c.after}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function fieldChangeCount(sectionKey: string, before: unknown, after: unknown): number {
  const label = SECTION_LABELS[sectionKey] ?? sectionKey
  return computeFieldDiff(label, before, after).length
}
export type { FieldChange }
```

- [ ] **步骤 2：确认卡换用字段级视图**

修改 `confirm-card/resume-field-diff.tsx`：原本渲染 `DiffView`（JSON 行 diff），改为渲染 `FieldDiffView`。需拿到 `sectionKey`——Read `confirm-card/index.tsx:26-28` 与 `preview` 类型，确认 `preview.sectionKey` 已存在（`resume.ts:134` 的 `preview` 含 `sectionKey`）。据此传入：

```tsx
// resume-field-diff.tsx（示意）
import { FieldDiffView } from '../diff/field-diff-view'
export function ResumeFieldDiff({ sectionKey, before, after }: { sectionKey: string, before: unknown, after: unknown }) {
  return <FieldDiffView sectionKey={sectionKey} before={before} after={after} />
}
```

并在 `confirm-card/index.tsx:27` 传入 `sectionKey={preview.sectionKey}`（确认 `preview` 类型含该字段，不含则在 preview 类型补充）。

- [ ] **步骤 3：变更记录换用字段级视图**

修改 `change-log/index.tsx` 第 108-112 行 `CollapsibleContent`，把 `kind==='diff'` 分支从 `<DiffView>` 改为 `<FieldDiffView sectionKey={change.undo?.sectionKey ?? ''} before={change.detail.before} after={change.detail.after} />`（`change.undo.sectionKey` 已存在，见 59 行；若 detail 无 sectionKey 则从 undo 取）。

- [ ] **步骤 4：构建校验 + 手动验收**

运行：`pnpm exec tsc --noEmit && pnpm lint`，再 `pnpm dev` 触发一次简历修改。
预期：确认卡与右侧变更记录都以"模块 #序号 · 字段名：原值 → 新值"的中文形式展示，不再是 JSON 代码块。

- [ ] **步骤 5：Commit**

```bash
git add src/pages/assistant/components/diff/field-diff-view.tsx src/pages/assistant/components/confirm-card/ src/pages/assistant/components/assistant-canvas/change-log/index.tsx
git commit -m "$(cat <<'EOF'
feat(assistant): 变更记录改为字段级中文对比

- 新增 FieldDiffView，确认卡与变更记录统一展示字段级增删改
- 替换原 JSON 代码 diff，用户可一眼看懂改动
EOF
)"
```

---

### 任务 16：变更记录快捷操作（需求②b）

**文件：**
- 修改：`src/pages/assistant/components/assistant-canvas/change-log/index.tsx`
- 修改：变更记录数据模型（`deriveCanvasModel`/`CanvasChange`，实现前 grep 定位，报告称在 `assistant-canvas/**/utils.ts`）
- 修改：工具重试 `src/pages/assistant/hooks/tool-retry.ts`（`retryToolCall`，扩展批量）
- 修改：`src/pages/resume/editor` 预览锚点/高亮（跳转目标）

**前置：** Read `assistant-canvas` 下的 `utils.ts`（`deriveCanvasModel`/`CanvasChange`/`CanvasModel`）、`tool-retry.ts`、以及预览渲染器 `RuntimeEntry`/`RuntimeSection` 以设计锚点。

- [ ] **步骤 1：批量应用/撤销**

在 `change-log/index.tsx` 列表顶部加操作条（本轮变更组）：

```tsx
<div className="flex items-center justify-between gap-2 px-1 pb-1">
  <span className="text-xs text-muted-foreground">本轮 {model.writes.length} 项变更</span>
  <div className="flex gap-1">
    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleUndoAll} disabled={undoAllPending}>
      <Undo2 className="size-3.5" /> 全部撤销
    </Button>
    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleReapplyAll} disabled={reapplyPending}>
      <RotateCcw className="size-3.5" /> 全部应用
    </Button>
  </div>
</div>
```

`handleUndoAll`：遍历 `model.writes` 中 `canUndo` 的项，逐个 `applyResumeFieldToDocument(currentId, sectionKey, before)` 并 `markChangeUndone`；`handleReapplyAll`：对已撤销项写回 `after`。均在末尾 `bumpCanvasRefresh()` 一次。

- [ ] **步骤 2：单条重做**

扩展现有单条撤销：撤销后按钮变"重做"，点击 `applyResumeFieldToDocument(currentId, sectionKey, after)` 并清除 undone 标记（新增 `markChangeRedone` 把 part 的 `undone` 置回 false）。需在 `change-log` 内维护/读取 `undone` 与 `after`（`change.detail.after` 已有）。

```tsx
{isUndone
  ? (
      <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={pendingId === change.id} onClick={() => handleRedo(change)}>
        <RotateCcw className="size-3.5" /> 重做
      </Button>
    )
  : canUndo && (/* 现有撤销按钮 */)}
```

- [ ] **步骤 3：失败项一键重试**

对 `change.state === 'error'` 的项显示"重试"按钮，调用 `retryToolCall`（Read `tool-retry.ts` 确认签名）。顶部操作条在存在失败项时显示"重试全部失败"。

- [ ] **步骤 4：跳转并高亮对应模块**

- 渲染器：给 `RuntimeSection`（`shared.tsx:167`）的 `<section>` 加 `id={\`resume-section-${sectionKey}\`}`（需给 `RuntimeSection` 传 `sectionKey` prop，各渲染器补传）；给 `RuntimeEntry` 外层加 `data-entry-id`。
- 变更记录每项加"定位"按钮：点后 `requestCanvasTab('preview')` 打开预览页，再 `document.getElementById(\`resume-section-${sectionKey}\`)?.scrollIntoView({block:'center',behavior:'smooth'})` 并加临时高亮 class（motion 或 tailwind ring，1.8s 后移除）。

```tsx
<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => handleLocate(change)}>
  <Crosshair className="size-3.5" /> 定位
</Button>
```

> **实现注意：** 预览在右侧画布，`requestCanvasTab` 打开后需等 DOM 挂载再滚动，用 `requestAnimationFrame` 或短延时。高亮机制可复用 message-list 的 motion 背景色渐变思路（`message-list/index.tsx:107-116`）。若跨 iframe/缩放容器，`scrollIntoView` 仍有效（同文档）。锚点粒度先做到 section 级，entry 级作为可选增强。

- [ ] **步骤 5：构建校验 + 手动验收**

运行：`pnpm exec tsc --noEmit && pnpm lint`，`pnpm dev` 走一遍。
预期：① 全部应用/撤销可用；② 单条撤销后可重做；③ 失败项可单独/批量重试；④ 点"定位"右侧预览滚动到对应模块并高亮。

- [ ] **步骤 6：Commit**

```bash
git add src/pages/assistant/components/assistant-canvas/ src/pages/assistant/hooks/tool-retry.ts src/components/resume/runtime/renderers/
git commit -m "$(cat <<'EOF'
feat(assistant): 变更记录快捷操作

- 支持全部应用/全部撤销、单条撤销/重做、失败项一键重试
- 新增定位按钮：跳转右侧预览对应模块并高亮
EOF
)"
```

---

### 任务 17：对话流工具行统计改字段数（需求②a 收尾）

**文件：**
- 修改：`src/pages/assistant/components/message-bubble/tool-call-part.tsx:17-26`（`statOf`）

- [ ] **步骤 1：统计改用字段变更条数**

Read `tool-call-part.tsx` 确认 `statOf` 与 `DiffStat` 用法。把基于 `computeLineDiff` 的增删行统计，改为用 `computeFieldDiff` 的变更条数（added 计入 additions、removed 计入 deletions、changed 各计一次或计入 changed）。保持 `DiffStat` 视觉，或改为显示"N 处改动"。

```tsx
import { computeFieldDiff } from '../diff/compute-field-diff'
import { SECTION_LABELS } from '../diff/field-labels'
// statOf：从 result.before/after + args.sectionKey 计算字段级增删
function statOf(part): { additions: number, deletions: number } | null {
  const res = part.result as { before?: unknown, after?: unknown } | undefined
  const sectionKey = (part.args as { sectionKey?: string })?.sectionKey
  if (!res || !('before' in res) || !('after' in res) || !sectionKey)
    return null
  const changes = computeFieldDiff(SECTION_LABELS[sectionKey] ?? sectionKey, res.before, res.after)
  return {
    additions: changes.filter(c => c.kind !== 'removed').length,
    deletions: changes.filter(c => c.kind !== 'added').length,
  }
}
```

- [ ] **步骤 2：构建校验 + 手动验收**

运行：`pnpm exec tsc --noEmit && pnpm lint`，`pnpm dev`。
预期：对话流工具轨迹行的 +N -N 反映字段级改动数，与展开的字段级对比一致。

- [ ] **步骤 3：Commit**

```bash
git add src/pages/assistant/components/message-bubble/tool-call-part.tsx
git commit -m "$(cat <<'EOF'
refactor(assistant): 工具行统计改为字段级变更数

- 对话流轨迹行 +N -N 与字段级对比口径统一
EOF
)"
```

---

## 自检结果

**规格覆盖度：**
- ① Schema 注入 → 任务 5、6 ✓
- ② 变更记录字段级对比 → 任务 13、14、15、17 ✓；四项快捷操作 → 任务 16 ✓
- ③ 对话分页 → 任务 10、11、12 ✓
- ④ 自动滚动 → 任务 1 ✓
- ⑤ 工具即时反馈 → 任务 7 ✓
- ⑥ 隐藏空行 → 任务 2、3、4 ✓
- ⑦ 条目级隐藏 → 任务 2（数据）、8（状态）、9（UI）✓

**占位符扫描：** 所有代码步骤含真实代码；标注"实现前先 Read/grep 确认"处为动态定位（类型/字段名/签名），非占位——因这些文件（`utils.ts`/`tool-retry.ts`/`write-plan.ts` 等）在本次未直读，要求执行者先确认再写，避免臆造签名。

**类型一致性：** `hidden` 字段、`FieldChange`、`computeFieldDiff(sectionLabel, before, after)`、`listMessages` 返回 `{messages,hasMore}`、`onToolCallPending({id,name})` 等跨任务命名已统一。

**依赖顺序：** 任务 2 → 3/4/9（hidden 字段先行）；13 → 14 → 15 → 16/17（diff 基础先行）；10 → 11 → 12（分页数据→状态→UI）。阶段间可独立交付。
