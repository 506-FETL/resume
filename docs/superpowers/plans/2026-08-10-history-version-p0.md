# 历史版本 P0（版本对比 + 保存去重）实现计划

> **面向 AI 代理的工作者：** 用 superpowers:executing-plans 或 subagent-driven-development 逐任务实现。步骤用复选框（`- [ ]`）跟踪进度。
>
> **本仓库特例：** AGENTS/记忆明确「不需要写测试」。因此不新增持久化测试文件；纯函数用一次性 node 脚本验证后删除，UI 用 `tsc --noEmit` + `eslint` 验证。用户可见文案一律轻量口语化，不出现「字段/行级/hash/版本号 V{n}」术语味措辞。

**目标：** 在 `/history` 历史页支持「保存去重」和「任意两版对比」，把备份流水升级为可用的版本历史。

**架构：** 复用已有 `content_hash`（`snapshot.ts` 的 SHA-256）做保存前比对；复用 `computeLineDiff`/`diffStat`/`DiffView` + `getOrderedSections`/label maps，新增纯函数 `diffSnapshots` 和 `CompareDialog` 组件，从详情头部入口打开。

**技术栈：** React + TS + Zustand + Tailwind；`motion/react`；`ResponsiveDialog`（桌面 Dialog / 移动 Drawer 自适应）。

---

## 文件结构

- 改 `src/pages/history/store/history-data.ts` — `saveCurrentVersion` 保存前去重。
- 增 `src/pages/history/utils/compare.ts` — 纯函数 `diffSnapshots` / `totalDiffStat` + 类型。
- 增 `src/pages/history/components/compare-dialog/index.tsx` — 对比弹窗（版本选择器 + diff 渲染）。
- 改 `src/pages/history/components/detail-panel/detail-header.tsx` — 「对比」按钮 + `compareOpen` 状态（两个分支：选中版分支必加；current 分支可选加）。

---

## 任务 1：保存去重

**文件：**
- 修改：`src/pages/history/store/history-data.ts`（`saveCurrentVersion`，约 111-141 行）

- [ ] **步骤 1：改 `saveCurrentVersion`，保存前比对最新版 hash**

把原来的实现改为先算一次 hash，再决定是否落库：

```ts
async saveCurrentVersion(draft) {
  const { resumeId, currentResume, versions } = get()
  if (!resumeId || !currentResume)
    return null

  set({ savingCurrent: true })

  try {
    const nextHash = await createResumeSnapshotHash(currentResume.snapshot)
    const latest = versions[0]
    // 内容与最新版本完全一致 → 不重复保存
    if (latest?.content_hash && latest.content_hash === nextHash) {
      toast.info('内容没有变化，已是最新版本')
      return null
    }

    const created = normalizeHistoryVersion(
      await createResumeHistoryVersion({
        resume_id: resumeId,
        ...toVersionMutationPayload(draft),
        source_type: 'manual',
        snapshot: currentResume.snapshot,
        content_hash: nextHash,
        base_updated_at: currentResume.updatedAt,
      }),
    )

    set({ versions: [created, ...versions] })
    toast.success('当前版本已保存')
    return created
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '保存版本失败')
    return null
  }
  finally {
    set({ savingCurrent: false })
  }
}
```

说明：`createResumeSnapshotHash` 已在本文件 import（原保存路径就在用）。`versions` 按 `version_no desc`，`versions[0]` 即最新。`content_hash` 为 null（旧数据）时不拦截，视为不同。

- [ ] **步骤 2：验证 tsc + eslint**

运行：`npx tsc --noEmit && npx eslint src/pages/history/store/history-data.ts`
预期：exit 0，无错误。

- [ ] **步骤 3：Commit**

```bash
git add src/pages/history/store/history-data.ts
git commit -m "feat(history): 保存当前版本前去重，内容无变化不重复保存"
```

---

## 任务 2：`diffSnapshots` 纯函数

**文件：**
- 创建：`src/pages/history/utils/compare.ts`

- [ ] **步骤 1：写 `compare.ts`**

```ts
import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import type { DiffLine, DiffStatValue } from '@/pages/assistant/components/diff/compute-line-diff'
import { computeLineDiff, diffStat } from '@/pages/assistant/components/diff/compute-line-diff'
import { FIELD_LABEL_MAP, SECTION_LABEL_MAP } from '../const'
import { getOrderedSections } from '../utils'

export interface FieldDiff {
  key: string
  label: string
  before: unknown
  after: unknown
  lines: DiffLine[]
  stat: DiffStatValue
}

export interface SectionDiff {
  sectionKey: string
  sectionLabel: string
  fields: FieldDiff[]
}

function fieldLabel(key: string): string {
  return FIELD_LABEL_MAP[key] ?? key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
}

// 把一个 section 的值摊平成 [key, value] 字段对：
// - 对象：取 entries；若仅含 items 数组则展开为 第1项/第2项…
// - 数组：按索引展开为 第N项
// - 标量/字符串：作为单一字段（key='value'）
function flattenSection(value: unknown): Array<{ key: string, label: string, value: unknown }> {
  if (Array.isArray(value)) {
    return value.map((item, i) => ({ key: String(i), label: `第 ${i + 1} 项`, value: item }))
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 1 && entries[0][0] === 'items')
      return flattenSection(entries[0][1])
    return entries.map(([key, item]) => ({ key, label: fieldLabel(key), value: item }))
  }
  return [{ key: 'value', label: '内容', value }]
}

export function diffSnapshots(before: ResumeSnapshot, after: ResumeSnapshot): SectionDiff[] {
  // section 顺序取并集，保持既有顺序（以 after 为主，补 before 独有）
  const order = getOrderedSections(after)
  const extra = getOrderedSections(before).filter(s => !order.includes(s))
  const sections = [...order, ...extra]

  const result: SectionDiff[] = []
  for (const section of sections) {
    const beforeFields = flattenSection((before as Record<string, unknown>)[section])
    const afterFields = flattenSection((after as Record<string, unknown>)[section])
    const keys = [...new Set([...beforeFields.map(f => f.key), ...afterFields.map(f => f.key)])]

    const fields: FieldDiff[] = []
    for (const key of keys) {
      const b = beforeFields.find(f => f.key === key)
      const a = afterFields.find(f => f.key === key)
      const lines = computeLineDiff(b?.value, a?.value)
      const stat = diffStat(lines)
      if (stat.additions + stat.deletions > 0) {
        fields.push({ key, label: (a ?? b)?.label ?? key, before: b?.value, after: a?.value, lines, stat })
      }
    }
    if (fields.length > 0)
      result.push({ sectionKey: section, sectionLabel: SECTION_LABEL_MAP[section] ?? section, fields })
  }
  return result
}

export function totalChangedFields(diffs: SectionDiff[]): number {
  return diffs.reduce((sum, s) => sum + s.fields.length, 0)
}
```

- [ ] **步骤 2：一次性 node 脚本验证（跑完删除）**

写 `/tmp/test-diff.mjs`，内联复刻 `computeLineDiff`/`diffStat`/`flattenSection`/核心 diff 逻辑，验证四个用例：
1. 改一个标量字段（basics.name 变） → 1 处改动
2. work_experience.items 加一条 → 1 处改动（新项）
3. 删一条 → 1 处改动
4. before === after → 0 处改动

运行：`node /tmp/test-diff.mjs`，预期全 PASS，然后 `rm -f /tmp/test-diff.mjs`。

- [ ] **步骤 3：验证 tsc + eslint**

运行：`npx tsc --noEmit && npx eslint src/pages/history/utils/compare.ts`
预期：exit 0。

- [ ] **步骤 4：Commit**

```bash
git add src/pages/history/utils/compare.ts
git commit -m "feat(history): 新增 diffSnapshots 版本差异计算"
```

---

## 任务 3：CompareDialog 组件

**文件：**
- 创建：`src/pages/history/components/compare-dialog/index.tsx`

前置事实（实现时按此对齐，勿臆测）：
- `useHistoryStore` 暴露 `versions: ResumeHistoryVersionRecord[]`（`version_no desc`）与 `currentResume`（含 `.snapshot`）。
- 版本记录字段：`id:number`、`version_no`、`created_at`、`source_type`、`snapshot`。
- `ResponsiveDialog` 系列从 `@/components/ui/responsive-dialog` 导入（参考 `jd-variant/components/generator-dialog.tsx` 的用法）。
- `DiffView` 从 `@/pages/assistant/components/diff/diff-view` 导入。
- `Select` 系列从 `@/components/ui/select`。

- [ ] **步骤 1：写 `compare-dialog/index.tsx`**

```tsx
import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { useMemo, useState } from 'react'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DiffView } from '@/pages/assistant/components/diff/diff-view'
import useHistoryStore from '../../store'
import { diffSnapshots, totalChangedFields } from '../../utils/compare'

interface CompareDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  baseId: string | null // 初始基准：版本 id 字符串 或 'current'
  targetId: string | null // 初始目标：版本 id 字符串 或 'current'
}

const CURRENT = 'current'

export default function CompareDialog({ open, onOpenChange, baseId, targetId }: CompareDialogProps) {
  const { versions, currentResume } = useHistoryStore()
  const [base, setBase] = useState<string>(baseId ?? CURRENT)
  const [target, setTarget] = useState<string>(targetId ?? CURRENT)

  // baseId/targetId 变化（重新打开）时同步
  useMemo(() => {
    if (open) {
      setBase(baseId ?? CURRENT)
      setTarget(targetId ?? CURRENT)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, baseId, targetId])

  const snapshotOf = (id: string): ResumeSnapshot | null => {
    if (id === CURRENT)
      return currentResume?.snapshot ?? null
    return versions.find(v => String(v.id) === id)?.snapshot ?? null
  }

  const options = useMemo(() => [
    ...(currentResume ? [{ value: CURRENT, label: '当前内容' }] : []),
    ...versions.map(v => ({ value: String(v.id), label: `第 ${v.version_no} 版 · ${new Date(v.created_at).toLocaleDateString()}` })),
  ], [versions, currentResume])

  const beforeSnap = snapshotOf(base)
  const afterSnap = snapshotOf(target)
  const diffs = useMemo(
    () => (beforeSnap && afterSnap ? diffSnapshots(beforeSnap, afterSnap) : []),
    [beforeSnap, afterSnap],
  )
  const changed = totalChangedFields(diffs)

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="min-h-0 sm:max-h-[82vh] sm:max-w-3xl">
        <ResponsiveDialogHeader className="shrink-0 gap-3 border-b px-6 pb-5 pt-6 text-left">
          <ResponsiveDialogTitle>版本对比</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>看看两个版本之间改了什么</ResponsiveDialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger className="h-8 w-auto min-w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">→</span>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="h-8 w-auto min-w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {changed > 0 ? `共 ${changed} 处改动` : ''}
            </span>
          </div>
        </ResponsiveDialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 px-6 py-5">
            {changed === 0
              ? (
                  <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-10 text-center text-sm text-muted-foreground">
                    两个版本内容一样
                  </p>
                )
              : diffs.map(section => (
                  <div key={section.sectionKey} className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold">{section.sectionLabel}</h3>
                    {section.fields.map(field => (
                      <div key={field.key} className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground">{field.label}</span>
                        <DiffView before={field.before} after={field.after} />
                      </div>
                    ))}
                  </div>
                ))}
          </div>
        </ScrollArea>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
```

- [ ] **步骤 2：验证 tsc + eslint**

运行：`npx tsc --noEmit && npx eslint src/pages/history/components/compare-dialog/index.tsx`
预期：exit 0。若 `ResponsiveDialogContent` 的 props/类名与派生弹窗不一致，以 `generator-dialog.tsx` 实际用法为准修正。

- [ ] **步骤 3：Commit**

```bash
git add src/pages/history/components/compare-dialog/index.tsx
git commit -m "feat(history): 新增版本对比弹窗"
```

---

## 任务 4：详情头部接入「对比」入口

**文件：**
- 修改：`src/pages/history/components/detail-panel/detail-header.tsx`

前置事实：
- 选中版分支已有按钮网格（`查看内容/恢复此版本/编辑信息/删除版本`，约 188-212 行）。
- `versions`、`currentResume` 已从 `useHistoryStore` 取到。
- `selectedVersion` 为当前详情选中的版本记录。

- [ ] **步骤 1：加 import 与状态**

在文件顶部 lucide 图标 import 里加 `GitCompare`；组件内与 `previewTarget` 等 `useState` 并列加：

```tsx
const [compareOpen, setCompareOpen] = useState(false)
```

在 import 区加：

```tsx
import CompareDialog from '../compare-dialog'
```

- [ ] **步骤 2：计算「上一版」作为默认基准**

在选中版分支渲染前（`sourceMeta` 附近）加：

```tsx
// 默认基准＝比当前选中版小的最近一版；没有更早版本则用「当前内容」
const olderVersion = versions.find(v => v.version_no < selectedVersion.version_no)
const compareBaseId = olderVersion ? String(olderVersion.id) : 'current'
const canCompare = versions.length >= 2 || Boolean(currentResume)
```

- [ ] **步骤 3：在按钮网格加「对比」按钮**

在「查看内容」按钮之后加（保持与现有按钮同款 `variant="outline"` + `w-full justify-center`）：

```tsx
<Button
  variant="outline"
  className="w-full justify-center"
  disabled={!canCompare}
  title={canCompare ? undefined : '还没有可对比的版本'}
  onClick={() => setCompareOpen(true)}
>
  <GitCompare data-icon="inline-start" />
  对比
</Button>
```

注意 `isMobile ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'` 的网格列数：移动端加入后变 5 个按钮（查看内容在移动端本就隐藏），把移动端网格从 `grid-cols-3` 调整为容纳「对比/恢复/编辑/删除」4 个的布局（`grid-cols-2` 更稳），实现时按实际按钮数校准。

- [ ] **步骤 4：挂载 CompareDialog**

在该分支已有的 `HistoryPreviewDialog`/`SaveVersionDialog` 旁加：

```tsx
<CompareDialog
  open={compareOpen}
  onOpenChange={setCompareOpen}
  baseId={compareBaseId}
  targetId={String(selectedVersion.id)}
/>
```

- [ ] **步骤 5：验证 tsc + eslint**

运行：`npx tsc --noEmit && npx eslint src/pages/history/components/detail-panel/detail-header.tsx`
预期：exit 0。

- [ ] **步骤 6：Commit**

```bash
git add src/pages/history/components/detail-panel/detail-header.tsx
git commit -m "feat(history): 版本详情接入对比入口"
```

---

## 任务 5：整体验证

- [ ] **步骤 1：全量 tsc + eslint**

运行：`npx tsc --noEmit && npx eslint src/pages/history`
预期：exit 0（`ui/` 忽略告警可接受）。

- [ ] **步骤 2：人工自检清单**
  - 版本 < 2 且无当前内容 → 「对比」禁用 + tooltip。
  - 打开对比默认「上一版 → 选中版」，可改选任意版/当前内容。
  - 改一个字段只显示该字段红绿；两侧相同显示「两个版本内容一样」。
  - 连点两次保存、内容没变 → 第二次提示「内容没有变化，已是最新版本」，不新增版本。

---

## 自检记录（作者已核对）

- **规格覆盖：** 去重（任务1）、diff 算法（任务2）、对比弹窗任意两版+统计+空态（任务3）、入口+默认上一版+禁用态（任务4）、验证（任务5）。规格「非目标」项均未纳入。
- **类型一致：** `diffSnapshots`/`totalChangedFields`/`SectionDiff`/`FieldDiff` 在任务2定义，任务3按同名使用；`DiffView` 入参 `before/after` 与 `computeLineDiff` 一致。
- **文案：** 「内容没有变化，已是最新版本」「共 N 处改动」「两个版本内容一样」「还没有可对比的版本」——均口语化、无术语。
- **无占位符。**
