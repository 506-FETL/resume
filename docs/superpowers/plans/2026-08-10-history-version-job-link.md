# 历史版本 版本→投递关联（P2 #6）实现计划

> **面向 AI 代理的工作者：** 用 superpowers:executing-plans 或 subagent-driven-development 逐任务实现，步骤用 `- [ ]` 跟踪。
>
> **本仓库特例：** 明确「不需要写测试」。不新增持久化测试文件；纯逻辑用一次性 node 脚本验证后删除，UI 用 `tsc --noEmit` + `eslint` 验证。用户可见文案轻量口语化。
>
> **⚠️ 迁移关卡：** 任务 1 是 DB 迁移文件；**执行迁移（`supabase db push`）是需用户确认的独立关卡**（任务 8），不要自行执行。前端代码（任务 2-7）可先写好，但没迁移时关联字段无法落库。

**目标：** 给「历史版本」加「关联岗位（company_id）+ 投递日期（submitted_at，日精度）」两项元信息，在版本详情的「编辑信息」里设置、只读态展示。

**架构：** 加两个 nullable 列（company_id FK→company ON DELETE SET NULL + submitted_at date），顺着现有 `VERSION_SELECTOR`/`toVersionMutationPayload`/`VersionMetadataDraft` 全链路接入；岗位下拉复用 `listJobApplicationSummaries()`。

**技术栈：** Supabase (Postgres migration) + React + TS + Zustand；`Select`、`Popover`+`Calendar`、`Field` 均为现成 UI 原语。

---

## 文件结构

- 增 `supabase/migrations/20260810000001_add_version_job_link.sql` — DB 两列 + FK + 索引。
- 改 `src/lib/supabase/resume/history/types.ts` — Base/Create/Update 加字段。
- 改 `src/lib/supabase/resume/history/queries.ts` — VERSION_SELECTOR + insert/update map。
- 改 `src/pages/history/types.ts` — VersionMetadataDraft 加字段。
- 改 `src/pages/history/utils.ts` — createMetadataDraft / normalizeDraft / toVersionMutationPayload。
- 增 `src/pages/history/hooks/use-job-summaries.ts` — 拉岗位列表 + id→标签映射。
- 改 `src/pages/history/components/shared/version-metadata-fields/index.tsx` — 关联岗位 Select + 投递日期 Calendar。
- 改 `src/pages/history/components/detail-panel/history-overview.tsx` — 两个只读 MetricCard。

---

## 任务 1：DB 迁移文件（仅创建，不执行）

**文件：** 创建 `supabase/migrations/20260810000001_add_version_job_link.sql`

- [ ] **步骤 1：写迁移 SQL**

```sql
-- 为历史版本增加「关联岗位 + 投递日期」；均 nullable，老数据不受影响。
-- company_id 关联求职看板岗位，岗位删除时置空（版本保留）。

ALTER TABLE public.resume_config_versions
  ADD COLUMN IF NOT EXISTS company_id uuid NULL,
  ADD COLUMN IF NOT EXISTS submitted_at date NULL;

ALTER TABLE public.resume_config_versions
  ADD CONSTRAINT resume_config_versions_company_id_fkey
    FOREIGN KEY (company_id)
    REFERENCES public.company (id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resume_config_versions_company_id
  ON public.resume_config_versions USING btree (company_id)
  WHERE company_id IS NOT NULL;
```

- [ ] **步骤 2：Commit（仅文件，不执行迁移）**

```bash
git add supabase/migrations/20260810000001_add_version_job_link.sql
git commit -m "feat(history): 新增版本关联岗位/投递日期迁移文件"
```

> 执行迁移见任务 8（用户关卡）。

---

## 任务 2：类型层加字段

**文件：** 修改 `src/lib/supabase/resume/history/types.ts`

- [ ] **步骤 1：给 `ResumeHistoryVersionBase` 加两字段**

在 `base_updated_at: string | null` 之后加：

```ts
  company_id: string | null
  submitted_at: string | null
```

- [ ] **步骤 2：给 Create/Update 输入加可选字段**

`CreateResumeHistoryVersionInput` 与 `UpdateResumeHistoryVersionInput` 各加：

```ts
  company_id?: string | null
  submitted_at?: string | null
```

- [ ] **步骤 3：验证**

运行：`npx tsc --noEmit`
预期：会出现「queries.ts 返回的 row 缺少 company_id/submitted_at」之类错误（下一任务修复），或通过（取决于 as 断言）。记录报错，继续任务 3。

---

## 任务 3：查询层 selector + 读写 map

**文件：** 修改 `src/lib/supabase/resume/history/queries.ts`

- [ ] **步骤 1：`VERSION_SELECTOR` 追加两列**

在 `base_updated_at` 行后追加（注意逗号）：

```
  base_updated_at,
  company_id,
  submitted_at
```

- [ ] **步骤 2：`createResumeHistoryVersion` 的 `.insert({...})` 加两项**

在 `base_updated_at: input.base_updated_at ?? null,` 后加：

```ts
    company_id: input.company_id ?? null,
    submitted_at: input.submitted_at ?? null,
```

- [ ] **步骤 3：`updateResumeHistoryVersion` 的 `.update({...})` 加两项**

在 `tags: input.tags ?? [],` 后加：

```ts
    company_id: input.company_id ?? null,
    submitted_at: input.submitted_at ?? null,
```

- [ ] **步骤 4：验证**

运行：`npx tsc --noEmit && npx eslint src/lib/supabase/resume/history/queries.ts src/lib/supabase/resume/history/types.ts`
预期：exit 0。

- [ ] **步骤 5：Commit**

```bash
git add src/lib/supabase/resume/history/types.ts src/lib/supabase/resume/history/queries.ts
git commit -m "feat(history): 版本类型与查询层支持关联岗位/投递日期"
```

---

## 任务 4：Draft 类型 + 工具函数

**文件：** 修改 `src/pages/history/types.ts`、`src/pages/history/utils.ts`

- [ ] **步骤 1：`VersionMetadataDraft` 加字段**（`src/pages/history/types.ts`）

在 `tags: string[]` 后加：

```ts
  companyId: string | null
  submittedAt: string | null
```

- [ ] **步骤 2：`createMetadataDraft` seed 新字段**（`src/pages/history/utils.ts`）

在返回对象里 `tags: normalizeTags(version?.tags),` 后加：

```ts
    companyId: version?.company_id ?? null,
    submittedAt: version?.submitted_at ?? null,
```

- [ ] **步骤 3：`normalizeDraft`（私有，dirty 比较）纳入新字段**

在其返回对象 `tags: normalizeTags(draft.tags),` 后加：

```ts
    companyId: draft.companyId ?? null,
    submittedAt: draft.submittedAt ?? null,
```

- [ ] **步骤 4：`toVersionMutationPayload` 输出新字段**

在返回对象 `tags: normalizeTags(draft.tags),` 后加：

```ts
    company_id: draft.companyId || null,
    submitted_at: draft.submittedAt || null,
```

- [ ] **步骤 5：一次性 node 脚本验证映射（跑完删）**

写 `/tmp/test-payload.mjs`，内联复刻 `toVersionMutationPayload` + `normalizeDraft` + `createMetadataDraft` + `isMetadataDraftDirty` 逻辑，验证：
1. draft 设 companyId='c1'、submittedAt='2026-08-10' → payload.company_id==='c1'、submitted_at==='2026-08-10'
2. draft 两字段为 null → payload 两字段 null
3. 从 record(company_id='c1') 建 draft，改 versionName → isDirty=true 且 companyId 仍为 'c1'（不丢）
4. 从 record(company_id='c1') 建 draft，只把 companyId 改成 null → isDirty=true

运行：`node /tmp/test-payload.mjs`，预期全 PASS，然后 `rm -f /tmp/test-payload.mjs`。

- [ ] **步骤 6：验证 + Commit**

运行：`npx tsc --noEmit && npx eslint src/pages/history/types.ts src/pages/history/utils.ts`
预期：exit 0。

```bash
git add src/pages/history/types.ts src/pages/history/utils.ts
git commit -m "feat(history): 版本元信息草稿支持关联岗位/投递日期"
```

---

## 任务 5：岗位列表 hook

**文件：** 创建 `src/pages/history/hooks/use-job-summaries.ts`

前置事实：`listJobApplicationSummaries()` 从 `@/lib/supabase/resume` 导出（barrel），返回 `JobApplicationSummary[]`（`{ id, company, position, ... }`）。

- [ ] **步骤 1：写 hook**

```ts
import type { JobApplicationSummary } from '@/lib/supabase/resume'
import { useEffect, useState } from 'react'
import { listJobApplicationSummaries } from '@/lib/supabase/resume'

export interface JobOption {
  id: string
  label: string // 「公司 · 职位」
}

/** 拉取当前用户的岗位列表，供版本关联岗位选择器使用；组件级一次性加载。 */
export function useJobSummaries() {
  const [jobs, setJobs] = useState<JobApplicationSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listJobApplicationSummaries()
      .then((rows) => {
        if (!cancelled)
          setJobs(rows)
      })
      .catch(() => {
        if (!cancelled)
          setJobs([])
      })
      .finally(() => {
        if (!cancelled)
          setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const options: JobOption[] = jobs.map(job => ({
    id: job.id,
    label: [job.company, job.position].filter(Boolean).join(' · ') || '未命名岗位',
  }))

  const getLabel = (companyId: string | null | undefined): string | null => {
    if (!companyId)
      return null
    return options.find(option => option.id === companyId)?.label ?? null
  }

  return { options, getLabel, loading }
}
```

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit && npx eslint src/pages/history/hooks/use-job-summaries.ts`
预期：exit 0。若 `JobApplicationSummary` 未从 barrel 导出，改从 `@/lib/supabase/resume/company` 导入（实现时以实际导出为准）。

- [ ] **步骤 3：Commit**

```bash
git add src/pages/history/hooks/use-job-summaries.ts
git commit -m "feat(history): 新增岗位列表 hook 供版本关联使用"
```

---

## 任务 6：编辑态表单加两字段

**文件：** 修改 `src/pages/history/components/shared/version-metadata-fields/index.tsx`

前置事实：现有用 `Field`/`FieldLabel`/`FieldDescription`（`@/components/ui/field`）、`Input`、`Textarea`、`VersionTagInput`。props：`{ draft: VersionMetadataDraft, onChange: (patch: Partial<VersionMetadataDraft>) => void }`。`Select` 来自 `@/components/ui/select`；`Popover`/`Calendar` 来自 `@/components/ui/popover` / `@/components/ui/calendar`；`dayjs` 已在项目使用。

- [ ] **步骤 1：加 import**

```tsx
import dayjs from 'dayjs'
import { CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useJobSummaries } from '../../../hooks/use-job-summaries'
```

- [ ] **步骤 2：组件内取岗位选项**

在组件函数体顶部加：

```tsx
const { options: jobOptions } = useJobSummaries()
const NONE = '__none__' // Select 不允许空字符串值，用哨兵表示「不关联」
```

- [ ] **步骤 3：在 `FieldGroup` 末尾加两个 Field**

```tsx
<Field>
  <FieldLabel>关联岗位</FieldLabel>
  <Select
    value={draft.companyId ?? NONE}
    onValueChange={value => onChange({ companyId: value === NONE ? null : value })}
  >
    <SelectTrigger>
      <SelectValue placeholder="选择投递的岗位" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value={NONE}>不关联</SelectItem>
      {jobOptions.map(option => (
        <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
      ))}
    </SelectContent>
  </Select>
  <FieldDescription>记录这一版投给了哪个岗位。</FieldDescription>
</Field>

<Field>
  <FieldLabel>投递日期</FieldLabel>
  <div className="flex items-center gap-2">
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start font-normal">
          <CalendarIcon data-icon="inline-start" />
          {draft.submittedAt ? draft.submittedAt : '选择日期'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          selected={draft.submittedAt ? dayjs(draft.submittedAt).toDate() : undefined}
          disabled={date => date > new Date()}
          onSelect={date => onChange({ submittedAt: date ? dayjs(date).format('YYYY-MM-DD') : null })}
        />
      </PopoverContent>
    </Popover>
    {draft.submittedAt && (
      <Button variant="ghost" size="icon-sm" aria-label="清除投递日期" onClick={() => onChange({ submittedAt: null })}>
        <X className="size-3.5" />
      </Button>
    )}
  </div>
  <FieldDescription>什么时候用这一版投递的。</FieldDescription>
</Field>
```

- [ ] **步骤 4：验证 + Commit**

运行：`npx tsc --noEmit && npx eslint src/pages/history/components/shared/version-metadata-fields/index.tsx`
预期：exit 0（import 顺序若报 perfectionist/sort-imports，按提示调整）。

```bash
git add src/pages/history/components/shared/version-metadata-fields/index.tsx
git commit -m "feat(history): 版本编辑表单支持选择关联岗位与投递日期"
```

---

## 任务 7：只读态展示两个 MetricCard

**文件：** 修改 `src/pages/history/components/detail-panel/history-overview.tsx`

前置事实：只读态用多个 `MetricCard`（`../metric-card` 或同目录，实现时确认导入路径）展示 版本号/来源/创建时间/重点标记；`selectedVersion` 有 `company_id`/`submitted_at`；lucide 图标从 `lucide-react` 导入。

- [ ] **步骤 1：加 import 与岗位标签解析**

```tsx
import { Briefcase, CalendarClock } from 'lucide-react'
import { useJobSummaries } from '../../hooks/use-job-summaries'
```

组件内（只读分支可见处）：

```tsx
const { getLabel } = useJobSummaries()
const jobLabel = getLabel(state.selectedVersion?.company_id)
```

- [ ] **步骤 2：在 MetricCard 列表加两张卡**

仿现有 `MetricCard` 用法追加（label/value 字段名以现有卡片为准）：

```tsx
<MetricCard icon={Briefcase} label="关联岗位" value={jobLabel ?? (state.selectedVersion?.company_id ? '岗位已删除' : '未关联')} />
<MetricCard icon={CalendarClock} label="投递日期" value={state.selectedVersion?.submitted_at ?? '未记录'} />
```

> 注：`company_id` 非空但 `getLabel` 返回 null（岗位已被删但外键尚未级联清空的窗口期）显示「岗位已删除」；正常删除会 SET NULL → 显示「未关联」。

- [ ] **步骤 3：验证 + Commit**

运行：`npx tsc --noEmit && npx eslint src/pages/history/components/detail-panel/history-overview.tsx`
预期：exit 0。

```bash
git add src/pages/history/components/detail-panel/history-overview.tsx
git commit -m "feat(history): 版本概览展示关联岗位与投递日期"
```

---

## 任务 8：执行迁移（⚠️ 用户确认关卡）

- [ ] **步骤 1：停下，请用户确认执行迁移**

前端代码（任务 2-7）已完成并通过 tsc/eslint。**数据库迁移需用户执行或明确授权**：

```bash
supabase db push
# 或用户项目约定的迁移执行方式
```

不要自行执行。向用户报告：迁移文件已就绪于 `supabase/migrations/20260810000001_add_version_job_link.sql`，等待确认执行。

- [ ] **步骤 2：迁移后端到端验证（用户执行迁移后）**

人工自检：
- 版本详情「编辑信息」→ 关联岗位下拉出现岗位列表；选一个 + 选投递日期 → 保存 → 只读态显示「公司·职位」+ 日期。
- 只改版本名保存 → 关联岗位/投递日期**不丢**。
- 关联「不关联」并保存 → 只读态显示「未关联」。
- 在求职看板删除该岗位 → 版本只读态显示「未关联」（SET NULL 生效）。

---

## 任务 9：整体验证

- [ ] **步骤 1：全量 tsc + eslint**

运行：`npx tsc --noEmit && npx eslint src/pages/history src/lib/supabase/resume/history`
预期：exit 0（既有无关告警除外）。

---

## 自检记录（作者已核对）

- **规格覆盖：** 迁移(任务1)、类型/查询(2-3)、draft/utils 四处(4)、岗位 hook(5)、编辑 UI(6)、只读 UI(7)、迁移关卡(8)、验证(9)。规格「非目标」（jd-派生、新建弹窗、岗位反向列表）均未纳入。
- **类型一致：** `company_id`/`submitted_at`（DB/Row/Record/Input，snake_case）与 `companyId`/`submittedAt`（Draft，camelCase）分别贯穿；`toVersionMutationPayload` 做 camel→snake 转换；`useJobSummaries` 的 `getLabel`/`options` 在任务5定义、6/7 使用一致。
- **迁移关卡：** 任务 8 明确为用户确认，不自行执行。
- **无占位符。**
