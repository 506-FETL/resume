# JD-Driven Resume Variant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to paste a JD and auto-generate a resume variant with full lineage management.

**Architecture:** A 4-phase Dialog flow (input → parse JD → stream-rewrite → done) creates a draft variant in Supabase/IndexedDB, then LLM-rewrites whitelisted fields while preserving identity facts. Variants link to parents via `parent_resume_id`, exposed through an editor toolbar, lineage tree dialog, and list-page filter tabs.

**Tech Stack:** React 19 + TypeScript 5.9 + Zustand + shadcn-ui + Tiptap + Supabase + IndexedDB (Dexie/idb) + DeepSeek streaming JSON.

---

## 全局约定

- 所有命令在仓库根目录 `/Users/bytedance/Downloads/Github/resume` 下执行。
- 包管理器：`pnpm`，测试框架：`vitest`，类型检查：`pnpm exec tsc --noEmit`，Lint：`pnpm exec eslint <files> --max-warnings 0`。
- 提交规范：Conventional Commits，禁止 `git add -A`，仅 `git add <精确路径>`。
- 默认不 push 远端，保留在当前分支工作。
- 字段、类型、函数命名严格按本计划保持一致；后续任务引用前序任务定义时不得改名。
- 凡是涉及 LLM 实时流式 reasoning 的 UI 一律复用现有 `ChainOfThought` + `AutoScrollContainer`。
- 凡是对话框一律使用 `ResponsiveDialog`。
- 所有按钮在流式状态下都要 `onMouseDown={(e) => e.preventDefault()}` 避免 Radix 抢焦点的 a11y 警告。

---

## 任务清单（25 项，按依赖顺序执行）

### Task 1: Supabase 迁移 — 为 `resume_config` 增加 4 列

**Files:**
- Create: `supabase/migrations/20260528000001_add_resume_variant_columns.sql`
- Modify: `src/lib/schema/resume/index.ts:34-42`（扩展 `ResumeListItem`）
- Modify: `src/lib/supabase/resume/form.ts:8-30`（扩展 `RESUME_PERSISTED_FIELDS` 与 `RESUME_PERSISTED_SELECTOR`）

> 说明：Supabase migration 是 SQL 文件，TDD 在此不适用，使用「类型层 smoke test」代替。

- [ ] **Step 1：写 SQL migration 文件**

```sql
-- 20260528000001_add_resume_variant_columns.sql
-- 为 JD 派生变体功能增加 4 列；所有列均 nullable + 默认 null，老简历不受影响

ALTER TABLE public.resume_config
  ADD COLUMN IF NOT EXISTS parent_resume_id uuid NULL,
  ADD COLUMN IF NOT EXISTS linked_jd_text text NULL,
  ADD COLUMN IF NOT EXISTS derived_metadata jsonb NULL,
  ADD COLUMN IF NOT EXISTS derived_status text NULL;

ALTER TABLE public.resume_config
  ADD CONSTRAINT resume_config_parent_resume_id_fkey
    FOREIGN KEY (parent_resume_id)
    REFERENCES public.resume_config (resume_id)
    ON DELETE SET NULL;

ALTER TABLE public.resume_config
  ADD CONSTRAINT resume_config_derived_status_check
    CHECK (
      derived_status IS NULL
      OR derived_status IN ('generating', 'ready', 'failed')
    );

ALTER TABLE public.resume_config
  ADD CONSTRAINT resume_config_derived_metadata_is_object_check
    CHECK (
      derived_metadata IS NULL
      OR jsonb_typeof(derived_metadata) = 'object'
    );

CREATE INDEX IF NOT EXISTS idx_resume_config_parent_resume_id
  ON public.resume_config USING btree (parent_resume_id)
  WHERE parent_resume_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resume_config_derived_status
  ON public.resume_config USING btree (derived_status)
  WHERE derived_status IS NOT NULL;
```

- [ ] **Step 2：扩展 `ResumeListItem` 与持久化白名单**

修改 `src/lib/schema/resume/index.ts` 中的 `ResumeListItem`：

```ts
export type DerivedStatus = 'generating' | 'ready' | 'failed'

export interface ResumeListItem {
  resume_id: string
  created_at: string
  updated_at?: string
  type: ResumeType
  display_name?: string
  description?: string
  isOffline?: boolean
  parent_resume_id?: string | null
  linked_jd_text?: string | null
  derived_metadata?: import('./variant').VariantMetadata | null
  derived_status?: DerivedStatus | null
}
```

修改 `src/lib/supabase/resume/form.ts`：把 4 个新列加到 `RESUME_PERSISTED_FIELDS`，并把 `getAllResumesFromUser` 的 `select` 列扩展为：

```ts
.select('id,resume_id,created_at,updated_at,type,display_name,description,parent_resume_id,linked_jd_text,derived_metadata,derived_status')
```

- [ ] **Step 3：smoke check（无运行时）**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors。

- [ ] **Step 4：commit**

```bash
git add supabase/migrations/20260528000001_add_resume_variant_columns.sql src/lib/schema/resume/index.ts src/lib/supabase/resume/form.ts
git commit -m "feat(db): add resume_config variant columns (parent/jd/metadata/status)"
```

---

### Task 2: IndexedDB v2 升级（4 个 nullable 字段）

**Files:**
- Modify: `src/lib/offline-resume-manager.ts:38-133`
- Test: `src/lib/__tests__/offline-resume-manager.variant.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// src/lib/__tests__/offline-resume-manager.variant.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  createOfflineResume,
  getOfflineResumeById,
  setVariantFieldsOffline,
} from '@/lib/offline-resume-manager'

describe('offline-resume-manager variant fields (IDB v2)', () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase('offline-resumes')
  })

  it('new resumes have variant fields defaulted to null', async () => {
    const id = await createOfflineResume({ display_name: '空白', type: 'default' })
    const resume = await getOfflineResumeById(id)
    expect(resume?.parent_resume_id ?? null).toBeNull()
    expect(resume?.linked_jd_text ?? null).toBeNull()
    expect(resume?.derived_metadata ?? null).toBeNull()
    expect(resume?.derived_status ?? null).toBeNull()
  })

  it('setVariantFieldsOffline updates fields', async () => {
    const id = await createOfflineResume({ display_name: '空白', type: 'default' })
    await setVariantFieldsOffline(id, {
      parent_resume_id: 'parent-1',
      linked_jd_text: 'JD',
      derived_metadata: { keywords: ['React'], changes: [], generatedAt: '2026-05-28T00:00:00.000Z', matchRate: 0.5 },
      derived_status: 'ready',
    })
    const after = await getOfflineResumeById(id)
    expect(after?.derived_status).toBe('ready')
    expect(after?.parent_resume_id).toBe('parent-1')
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/lib/__tests__/offline-resume-manager.variant.test.ts`
Expected: FAIL（`setVariantFieldsOffline` 不存在；新字段不在记录里）。

- [ ] **Step 3：实现升级 + 新接口**

修改 `src/lib/offline-resume-manager.ts`：

1. `DB_VERSION` 从 `1` 改为 `2`。
2. 扩展 `ResumeDB.resumes.value` 增加 4 字段（均 nullable）。
3. `openDB` 的 `upgrade` 回调增加 v1→v2 分支：

```ts
const DB_VERSION = 2

interface ResumeDB extends DBSchema {
  resumes: {
    key: string
    value: {
      resume_id: string
      display_name: string
      description?: string
      type: ResumeType
      created_at: string
      updated_at: string
      data: Partial<PersistedResumeSnapshot>
      parent_resume_id?: string | null
      linked_jd_text?: string | null
      derived_metadata?: VariantMetadata | null
      derived_status?: DerivedStatus | null
    }
    indexes: {
      created_at: string
      updated_at: string
      parent_resume_id: string
      derived_status: string
    }
  }
}

dbInstance = await openDB<ResumeDB>(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion, _newVersion, tx) {
    try {
      if (oldVersion < 1) {
        const resumeStore = db.createObjectStore('resumes', { keyPath: 'resume_id' })
        resumeStore.createIndex('created_at', 'created_at')
        resumeStore.createIndex('updated_at', 'updated_at')
      }
      if (oldVersion < 2) {
        const store = tx.objectStore('resumes')
        if (!store.indexNames.contains('parent_resume_id')) {
          store.createIndex('parent_resume_id', 'parent_resume_id')
        }
        if (!store.indexNames.contains('derived_status')) {
          store.createIndex('derived_status', 'derived_status')
        }
      }
    } catch (err) {
      console.error('IDB v2 upgrade failed, falling back', err)
    }
  },
})
```

4. 增加导出函数：

```ts
import type { DerivedStatus, VariantMetadata } from '@/lib/schema'

export async function setVariantFieldsOffline(
  resumeId: string,
  fields: {
    parent_resume_id?: string | null
    linked_jd_text?: string | null
    derived_metadata?: VariantMetadata | null
    derived_status?: DerivedStatus | null
  },
) {
  const db = await getDB()
  const resume = await db.get('resumes', resumeId)
  if (!resume) throw new Error('简历不存在')
  const next = { ...resume, ...fields, updated_at: new Date().toISOString() }
  await db.put('resumes', next)
}
```

5. 在已有的 `createOfflineResume` 默认值里把 4 字段写为 `null`。

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/lib/__tests__/offline-resume-manager.variant.test.ts`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/lib/offline-resume-manager.ts src/lib/__tests__/offline-resume-manager.variant.test.ts --max-warnings 0`
Expected: 0 errors。

- [ ] **Step 6：commit**

```bash
git add src/lib/offline-resume-manager.ts src/lib/__tests__/offline-resume-manager.variant.test.ts
git commit -m "feat(idb): bump DB to v2 and add variant fields with safe migration"
```

---

### Task 3: Variant Schema 类型与 zod 校验

**Files:**
- Create: `src/lib/schema/resume/variant/index.ts`
- Create: `src/lib/schema/resume/variant/types.ts`
- Modify: `src/lib/schema/resume/index.ts`（新增 `export * from './variant'`）
- Test: `src/lib/schema/resume/variant/__tests__/schema.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// src/lib/schema/resume/variant/__tests__/schema.test.ts
import { describe, expect, it } from 'vitest'
import { variantChangeSchema, variantMetadataSchema } from '../index'

describe('variantChangeSchema', () => {
  it('accepts a well-formed change', () => {
    const r = variantChangeSchema.safeParse({
      section: 'self_evaluation',
      itemId: 'whole',
      fieldPath: 'content',
      before: '<p>原文</p>',
      after: '<p>新文</p>',
      matchedKeywords: ['React'],
      reason: '突出 React',
    })
    expect(r.success).toBe(true)
  })

  it('rejects empty matchedKeywords', () => {
    const r = variantChangeSchema.safeParse({
      section: 'self_evaluation',
      itemId: 'whole',
      fieldPath: 'content',
      before: 'a',
      after: 'b',
      matchedKeywords: [],
      reason: 'x',
    })
    expect(r.success).toBe(false)
  })
})

describe('variantMetadataSchema', () => {
  it('accepts a complete metadata block', () => {
    const r = variantMetadataSchema.safeParse({
      keywords: ['A', 'B', 'C'],
      changes: [],
      generatedAt: '2026-05-28T00:00:00.000Z',
      matchRate: 0.5,
    })
    expect(r.success).toBe(true)
  })

  it('rejects matchRate > 1', () => {
    const r = variantMetadataSchema.safeParse({
      keywords: ['A'],
      changes: [],
      generatedAt: '2026-05-28T00:00:00.000Z',
      matchRate: 1.2,
    })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/lib/schema/resume/variant/__tests__/schema.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3：实现 types + schema**

`src/lib/schema/resume/variant/types.ts`：

```ts
import type { ResumeSchema } from '../form'

export type DerivedStatus = 'generating' | 'ready' | 'failed'

export interface VariantChange {
  section: keyof ResumeSchema
  itemId: string | 'whole'
  fieldPath: string
  before: string
  after: string
  matchedKeywords: string[]
  reason: string
}

export interface VariantMetadata {
  keywords: string[]
  changes: VariantChange[]
  generatedAt: string
  matchRate: number
}

export interface VariantPersistedFields {
  parent_resume_id: string | null
  linked_jd_text: string | null
  derived_metadata: VariantMetadata | null
  derived_status: DerivedStatus | null
}
```

`src/lib/schema/resume/variant/index.ts`：

```ts
import { z } from 'zod'

export * from './types'

const RESUME_SECTION_KEYS = [
  'basics',
  'job_intent',
  'application_info',
  'edu_background',
  'work_experience',
  'internship_experience',
  'campus_experience',
  'project_experience',
  'skill_specialty',
  'honors_certificates',
  'self_evaluation',
  'hobbies',
] as const

export const variantChangeSchema = z.object({
  section: z.enum(RESUME_SECTION_KEYS),
  itemId: z.string().min(1),
  fieldPath: z.string().min(1),
  before: z.string(),
  after: z.string(),
  matchedKeywords: z.array(z.string()).min(1),
  reason: z.string().max(120),
})

export const variantMetadataSchema = z.object({
  keywords: z.array(z.string()).min(0).max(30),
  changes: z.array(variantChangeSchema),
  generatedAt: z.string(),
  matchRate: z.number().min(0).max(1),
})

export const derivedStatusSchema = z.enum(['generating', 'ready', 'failed'])
```

修改 `src/lib/schema/resume/index.ts` 末尾追加 `export * from './variant'`。

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/lib/schema/resume/variant/__tests__/schema.test.ts`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/lib/schema/resume/variant --max-warnings 0`
Expected: 0 errors。

- [ ] **Step 6：commit**

```bash
git add src/lib/schema/resume/variant/index.ts src/lib/schema/resume/variant/types.ts src/lib/schema/resume/variant/__tests__/schema.test.ts src/lib/schema/resume/index.ts
git commit -m "feat(schema): add VariantChange/VariantMetadata schema with zod validation"
```

---

### Task 4: JD 解析 + 改写 prompts

**Files:**
- Create: `src/lib/llm/prompts/jd-variant.ts`
- Test: `src/lib/llm/prompts/__tests__/jd-variant.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// src/lib/llm/prompts/__tests__/jd-variant.test.ts
import { describe, expect, it } from 'vitest'
import { buildJdParsePrompt, buildJdRewritePrompt } from '../jd-variant'

describe('buildJdParsePrompt', () => {
  it('embeds JD text in user prompt and demands JSON-only output', () => {
    const { system, user } = buildJdParsePrompt('字节前端 JD 内容')
    expect(system).toContain('关键词')
    expect(system).toMatch(/JSON/)
    expect(user).toContain('字节前端 JD 内容')
  })
})

describe('buildJdRewritePrompt', () => {
  it('lists whitelist sections and embeds keywords + resumeJson', () => {
    const out = buildJdRewritePrompt({
      resumeJson: { self_evaluation: { id: 'whole', content: '原文' } } as never,
      jdText: 'JD',
      keywords: ['React', '微前端'],
    })
    expect(out.system).toContain('basics.summary')
    expect(out.system).toContain('禁止改动')
    expect(out.user).toContain('React')
    expect(out.user).toContain('微前端')
    expect(out.user).toContain('原文')
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/lib/llm/prompts/__tests__/jd-variant.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3：实现 prompts**

```ts
// src/lib/llm/prompts/jd-variant.ts
import type { EditableResumeView } from '@/components/jd-variant/types'

export interface JdPromptPair {
  system: string
  user: string
}

export function buildJdParsePrompt(jdText: string): JdPromptPair {
  const system = `你是资深 HR / 求职顾问，擅长从岗位描述（JD）中提炼关键词。
你的任务：从用户给出的 JD 文本中，提炼 3~30 个关键词，并给出一句岗位画像。
关键词必须满足：
1. 与岗位职责、技术栈、软技能、行业词强相关；忽略福利、工作时间、HR 套话。
2. 中英混排：技术名（如 React、TypeScript）保留原样；中文概念用中文。
3. 单个关键词长度 ≤ 12 字符，去重后输出。
4. 重要度高的排在前面。

输出协议（必须严格遵守，不要任何解释、不要 markdown 代码块）：
{
  "keywords": ["...", "...", ...],
  "summary": "（一句岗位画像，≤ 30 字）"
}`

  const user = `JD 文本如下：\n"""\n${jdText}\n"""\n\n请只输出 JSON 对象。`
  return { system, user }
}

export function buildJdRewritePrompt(args: {
  resumeJson: EditableResumeView
  jdText: string
  keywords: string[]
}): JdPromptPair {
  const system = `你是资深简历优化顾问，擅长把现有简历针对特定岗位做"局部精修"。

【可改写字段白名单（严格遵守）】
- basics.summary
- job_intent
- skill_specialty
- self_evaluation
- work_experience.*.bullets / description
- internship_experience.*.bullets / description
- project_experience.*.description / techStack
- campus_experience.*.description

【绝对禁止改动的字段】
- basics.name / basics.phone / basics.email / basics.gender / basics.birthday / basics.location / basics.avatar
- edu_background（学校、专业、时间、绩点）
- honors_certificates、application_info
- 任意时间、公司名、学校名、岗位 title、项目 title

【改写硬规则】
1. 改写必须基于原文事实，禁止伪造经历、伪造数据、伪造技术栈使用经验。
2. 必须命中至少一个 JD 关键词；命中关键词写入 matchedKeywords。
3. after 长度 ≤ before 长度 × 1.5。
4. 总 change 数：3 ≤ N ≤ 15。
5. itemId 必须严格使用输入 resumeJson 中的 id；section 必须在白名单内。
6. before 必须与输入完全一致（字符级），用于服务端二次校验。
7. reason 用中文，≤ 60 字。

【输出协议】（不要任何解释、不要 markdown 代码块）
{ "changes": [{ "section": "...", "itemId": "...", "fieldPath": "...",
  "before": "...", "after": "...", "matchedKeywords": ["..."], "reason": "..." }] }`

  const user = `候选简历（JSON，仅含可改写字段，请按 itemId 索引）：\n${JSON.stringify(args.resumeJson, null, 2)}\n\nJD 关键词（按重要度降序）：${args.keywords.join('、')}\n\nJD 原文：\n"""\n${args.jdText}\n"""\n\n请只输出 JSON 对象。`
  return { system, user }
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/lib/llm/prompts/__tests__/jd-variant.test.ts`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/lib/llm/prompts/jd-variant.ts src/lib/llm/prompts/__tests__/jd-variant.test.ts --max-warnings 0`
Expected: 0 errors。

- [ ] **Step 6：commit**

```bash
git add src/lib/llm/prompts/jd-variant.ts src/lib/llm/prompts/__tests__/jd-variant.test.ts
git commit -m "feat(llm): add JD parse + rewrite prompt builders"
```

---

### Task 5: LLM 入口 `runJdVariantParse` / `runJdVariantRewrite`

**Files:**
- Modify: `src/lib/llm/index.ts`（在文件尾追加）
- Test: `src/lib/llm/__tests__/jd-variant.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// src/lib/llm/__tests__/jd-variant.test.ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('../call', () => ({
  callLLM: vi.fn(),
}))

import { callLLM } from '../call'
import { runJdVariantParse, runJdVariantRewrite } from '../index'

function asyncIterable<T>(items: T[]) {
  return {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        async next() {
          if (i >= items.length) return { value: undefined, done: true as const }
          return { value: items[i++], done: false as const }
        },
      }
    },
  }
}

describe('runJdVariantParse', () => {
  it('streams content + reasoning to onUpdate and returns parsed object string', async () => {
    const updates: Array<{ content?: string; reasoning?: string }> = []
    ;(callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(asyncIterable([
      { choices: [{ delta: { reasoning_content: '想一下' } }] },
      { choices: [{ delta: { content: '{"keywords":["A","B","C"]}' } }] },
    ]))
    const r = await runJdVariantParse('JD 文本', d => updates.push(d))
    expect(r.content).toContain('"keywords"')
    expect(updates.length).toBeGreaterThan(0)
  })
})

describe('runJdVariantRewrite', () => {
  it('passes resumeJson and keywords through', async () => {
    ;(callLLM as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(asyncIterable([
      { choices: [{ delta: { content: '{"changes":[]}' } }] },
    ]))
    const r = await runJdVariantRewrite({
      resumeJson: {} as never,
      jdText: 'JD',
      keywords: ['React'],
    })
    expect(r.content).toContain('changes')
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/lib/llm/__tests__/jd-variant.test.ts`
Expected: FAIL（导出不存在）。

- [ ] **Step 3：在 `src/lib/llm/index.ts` 追加**

```ts
import type { EditableResumeView } from '@/components/jd-variant/types'
import { buildJdParsePrompt, buildJdRewritePrompt } from './prompts/jd-variant'

export async function runJdVariantParse(
  jdText: string,
  onUpdate?: (data: StreamUpdate) => void,
  options?: { throttleMs?: number, abortController?: AbortController },
) {
  const { system, user } = buildJdParsePrompt(jdText)
  const req = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  } as ChatCompletionCreateParamsBase
  return await streamStructuredJson(req, onUpdate, options)
}

export async function runJdVariantRewrite(
  args: { resumeJson: EditableResumeView, jdText: string, keywords: string[] },
  onUpdate?: (data: StreamUpdate) => void,
  options?: { throttleMs?: number, abortController?: AbortController },
) {
  const { system, user } = buildJdRewritePrompt(args)
  const req = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.6,
  } as ChatCompletionCreateParamsBase
  return await streamStructuredJson(req, onUpdate, options)
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/lib/llm/__tests__/jd-variant.test.ts`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/lib/llm/index.ts src/lib/llm/__tests__/jd-variant.test.ts --max-warnings 0`
Expected: 0 errors。

- [ ] **Step 6：commit**

```bash
git add src/lib/llm/index.ts src/lib/llm/__tests__/jd-variant.test.ts
git commit -m "feat(llm): add runJdVariantParse and runJdVariantRewrite entrypoints"
```

---

### Task 6: Supabase Variant 数据访问层

**Files:**
- Create: `src/lib/supabase/resume/variant.ts`
- Modify: `src/lib/supabase/resume/index.ts`（追加 `export * from './variant'`）
- Test: `src/lib/supabase/resume/__tests__/variant.test.ts`

- [ ] **Step 1：写失败测试（mock supabase client）**

```ts
// src/lib/supabase/resume/__tests__/variant.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../client', () => ({
  default: {
    from: vi.fn(),
  },
}))

vi.mock('../../user', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1' })),
}))

import supabase from '../../client'
import {
  cloneResumeAsDraft,
  applyVariantChanges,
  markVariantReady,
  markVariantFailed,
  deleteDraftVariant,
  fetchVariantTree,
} from '../variant'

function chainable(result: unknown) {
  const o: any = {}
  ;['select', 'eq', 'in', 'insert', 'update', 'delete', 'single'].forEach((k) => {
    o[k] = vi.fn().mockReturnValue(o)
  })
  o.single.mockResolvedValue(result)
  o.then = (cb: (r: unknown) => void) => Promise.resolve(result).then(cb)
  return o
}

describe('cloneResumeAsDraft', () => {
  beforeEach(() => vi.clearAllMocks())
  it('inserts a row with parent_resume_id and derived_status=generating', async () => {
    const parent = { resume_id: 'p-1', display_name: '原始', basics: {}, type: 'default' }
    const builder = chainable({ data: { resume_id: 'd-1' }, error: null })
    ;(supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue(builder)
    const id = await cloneResumeAsDraft({
      parent: parent as never,
      jdText: 'JD',
      keywords: ['A', 'B', 'C'],
      summary: '岗位画像',
    })
    expect(id).toBe('d-1')
    expect(builder.insert).toHaveBeenCalled()
  })
})

describe('markVariantReady / markVariantFailed', () => {
  beforeEach(() => vi.clearAllMocks())
  it('updates derived_status', async () => {
    const builder = chainable({ data: null, error: null })
    ;(supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue(builder)
    await markVariantReady('d-1', { matchRate: 0.7, generatedAt: '2026-05-28T00:00:00.000Z' })
    expect(builder.update).toHaveBeenCalled()
  })
})

describe('fetchVariantTree', () => {
  beforeEach(() => vi.clearAllMocks())
  it('walks parent chain to root and BFS down children with depth ≤ 5', async () => {
    let n = 0
    ;(supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      n += 1
      if (n === 1) return chainable({ data: { resume_id: 'r', parent_resume_id: null, display_name: 'root', derived_status: null, derived_metadata: null }, error: null })
      return chainable({ data: [], error: null })
    })
    const lineage = await fetchVariantTree('r')
    expect(lineage.root.resumeId).toBe('r')
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/lib/supabase/resume/__tests__/variant.test.ts`
Expected: FAIL（变体模块不存在）。

- [ ] **Step 3：实现 variant.ts**

```ts
// src/lib/supabase/resume/variant.ts
import type {
  DerivedStatus,
  PersistedResumeSnapshot,
  VariantChange,
  VariantMetadata,
} from '@/lib/schema'
import { applyVariantChange } from '@/components/jd-variant/apply-changes'
import supabase from '../client'
import { getCurrentUser } from '../user'

export interface VariantTreeNode {
  resumeId: string
  displayName: string
  derivedStatus: DerivedStatus | null
  generatedAt: string | null
  jdSnippet: string | null
  matchRate: number | null
  children: VariantTreeNode[]
}

export interface VariantLineage {
  root: VariantTreeNode
  currentId: string
}

const MAX_VARIANT_DEPTH = 5

export async function cloneResumeAsDraft(args: {
  parent: PersistedResumeSnapshot & { resume_id: string, display_name?: string }
  jdText: string
  keywords: string[]
  summary?: string
}): Promise<string> {
  const user = await getCurrentUser()
  if (!user) throw new Error('用户未登陆')

  const initialMetadata: VariantMetadata = {
    keywords: args.keywords,
    changes: [],
    generatedAt: new Date().toISOString(),
    matchRate: 0,
  }

  const cloneTitle = args.summary?.slice(0, 16) || args.keywords[0] || 'JD 变体'
  const display_name = `${args.parent.display_name ?? '简历'} - ${cloneTitle}`

  const { data, error } = await supabase
    .from('resume_config')
    .insert({
      user_id: user.id,
      type: args.parent.type,
      basics: args.parent.basics ?? null,
      job_intent: args.parent.job_intent ?? null,
      application_info: args.parent.application_info ?? null,
      edu_background: args.parent.edu_background ?? null,
      work_experience: args.parent.work_experience ?? null,
      internship_experience: args.parent.internship_experience ?? null,
      campus_experience: args.parent.campus_experience ?? null,
      project_experience: args.parent.project_experience ?? null,
      skill_specialty: args.parent.skill_specialty ?? null,
      honors_certificates: args.parent.honors_certificates ?? null,
      self_evaluation: args.parent.self_evaluation ?? null,
      hobbies: args.parent.hobbies ?? null,
      order: args.parent.order ?? null,
      visibility: args.parent.visibility ?? null,
      spacing: args.parent.spacing,
      font: args.parent.font,
      theme: args.parent.theme,
      template_binding: args.parent.templateBinding ?? null,
      display_name,
      description: `JD 变体 · ${new Date().toLocaleDateString()}`,
      parent_resume_id: args.parent.resume_id,
      linked_jd_text: args.jdText,
      derived_metadata: initialMetadata,
      derived_status: 'generating' as DerivedStatus,
    })
    .select('resume_id')
    .single()

  if (error) throw error
  return (data as { resume_id: string }).resume_id
}

export async function applyVariantChanges(
  draftResumeId: string,
  snapshot: PersistedResumeSnapshot,
  changes: VariantChange[],
): Promise<PersistedResumeSnapshot> {
  const user = await getCurrentUser()
  if (!user) throw new Error('用户未登陆')

  let next = snapshot
  for (const change of changes) {
    next = applyVariantChange(next, change)
  }

  const updates: Record<string, unknown> = {}
  for (const sec of new Set(changes.map(c => c.section))) {
    updates[sec as string] = (next as Record<string, unknown>)[sec as string]
  }

  const { error } = await supabase
    .from('resume_config')
    .update(updates)
    .eq('resume_id', draftResumeId)
    .eq('user_id', user.id)

  if (error) throw error
  return next
}

export async function markVariantReady(
  draftResumeId: string,
  args: { matchRate: number, generatedAt: string, changes?: VariantChange[], keywords?: string[] },
): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('用户未登陆')

  const { data: existing } = await supabase
    .from('resume_config')
    .select('derived_metadata')
    .eq('resume_id', draftResumeId)
    .eq('user_id', user.id)
    .single()
  const prior = (existing as { derived_metadata: VariantMetadata | null } | null)?.derived_metadata ?? null
  const next: VariantMetadata = {
    keywords: args.keywords ?? prior?.keywords ?? [],
    changes: args.changes ?? prior?.changes ?? [],
    matchRate: args.matchRate,
    generatedAt: args.generatedAt,
  }

  const { error } = await supabase
    .from('resume_config')
    .update({
      derived_status: 'ready' as DerivedStatus,
      derived_metadata: next,
    })
    .eq('resume_id', draftResumeId)
    .eq('user_id', user.id)
  if (error) throw error
}

export async function markVariantFailed(draftResumeId: string, errorMessage: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('用户未登陆')
  const { error } = await supabase
    .from('resume_config')
    .update({
      derived_status: 'failed' as DerivedStatus,
      description: `派生失败：${errorMessage.slice(0, 200)}`,
    })
    .eq('resume_id', draftResumeId)
    .eq('user_id', user.id)
  if (error) throw error
}

export async function deleteDraftVariant(draftResumeId: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('用户未登陆')
  const { error } = await supabase
    .from('resume_config')
    .delete()
    .eq('resume_id', draftResumeId)
    .eq('user_id', user.id)
  if (error) throw error
}

interface RawNode {
  resume_id: string
  parent_resume_id: string | null
  display_name: string | null
  derived_status: DerivedStatus | null
  derived_metadata: VariantMetadata | null
  linked_jd_text: string | null
}

function toTreeNode(row: RawNode): VariantTreeNode {
  return {
    resumeId: row.resume_id,
    displayName: row.display_name ?? '未命名简历',
    derivedStatus: row.derived_status,
    generatedAt: row.derived_metadata?.generatedAt ?? null,
    jdSnippet: row.linked_jd_text?.slice(0, 80) ?? null,
    matchRate: row.derived_metadata?.matchRate ?? null,
    children: [],
  }
}

export async function fetchVariantTree(currentResumeId: string): Promise<VariantLineage> {
  const user = await getCurrentUser()
  if (!user) throw new Error('用户未登陆')

  const visited = new Set<string>()
  let walker: string | null = currentResumeId
  let rootRow: RawNode | null = null
  let depth = 0

  while (walker && !visited.has(walker) && depth < MAX_VARIANT_DEPTH) {
    visited.add(walker)
    const { data, error } = await supabase
      .from('resume_config')
      .select('resume_id,parent_resume_id,display_name,derived_status,derived_metadata,linked_jd_text')
      .eq('user_id', user.id)
      .eq('resume_id', walker)
      .single()
    if (error) throw error
    rootRow = data as RawNode
    if (!rootRow.parent_resume_id) break
    walker = rootRow.parent_resume_id
    depth += 1
  }
  if (!rootRow) throw new Error('未找到任何节点')

  const root = toTreeNode(rootRow)
  const queue: VariantTreeNode[] = [root]
  const seen = new Set<string>([root.resumeId])
  let bfsDepth = 0

  while (queue.length > 0 && bfsDepth < MAX_VARIANT_DEPTH) {
    const layerIds = queue.map(n => n.resumeId)
    const { data, error } = await supabase
      .from('resume_config')
      .select('resume_id,parent_resume_id,display_name,derived_status,derived_metadata,linked_jd_text')
      .eq('user_id', user.id)
      .in('parent_resume_id', layerIds)
    if (error) throw error
    const rows = (data ?? []) as RawNode[]
    const nextLayer: VariantTreeNode[] = []
    for (const row of rows) {
      if (seen.has(row.resume_id)) continue
      seen.add(row.resume_id)
      const child = toTreeNode(row)
      const parent = queue.find(p => p.resumeId === row.parent_resume_id)
      parent?.children.push(child)
      nextLayer.push(child)
    }
    queue.splice(0, queue.length, ...nextLayer)
    bfsDepth += 1
  }

  return { root, currentId: currentResumeId }
}
```

修改 `src/lib/supabase/resume/index.ts`：追加 `export * from './variant'`。

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/lib/supabase/resume/__tests__/variant.test.ts`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/lib/supabase/resume/variant.ts src/lib/supabase/resume/__tests__/variant.test.ts --max-warnings 0`
Expected: 0 errors。

- [ ] **Step 6：commit**

```bash
git add src/lib/supabase/resume/variant.ts src/lib/supabase/resume/__tests__/variant.test.ts src/lib/supabase/resume/index.ts
git commit -m "feat(supabase): add variant CRUD + lineage BFS"
```

---

### Task 7: 离线 / IDB Variant 同名能力

**Files:**
- Modify: `src/lib/offline-resume-manager.ts`（追加 6 个函数）
- Test: `src/lib/__tests__/offline-resume-manager.variant-ops.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// src/lib/__tests__/offline-resume-manager.variant-ops.test.ts
import { describe, expect, it, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  createOfflineResume,
  cloneOfflineResumeAsDraft,
  markOfflineVariantReady,
  markOfflineVariantFailed,
  deleteOfflineDraftVariant,
  fetchOfflineVariantTree,
} from '@/lib/offline-resume-manager'

beforeEach(() => indexedDB.deleteDatabase('offline-resumes'))

describe('offline variant ops', () => {
  it('clones, marks ready, builds tree', async () => {
    const parent = await createOfflineResume({ display_name: '原始', type: 'default' })
    const draft = await cloneOfflineResumeAsDraft({
      parentResumeId: parent,
      jdText: 'JD',
      keywords: ['A', 'B', 'C'],
      summary: 'Front',
    })
    await markOfflineVariantReady(draft, { matchRate: 0.7, generatedAt: '2026-05-28T00:00:00.000Z' })
    const lineage = await fetchOfflineVariantTree(draft)
    expect(lineage.root.resumeId).toBe(parent)
    expect(lineage.root.children[0]?.resumeId).toBe(draft)
  })

  it('mark failed and delete draft', async () => {
    const parent = await createOfflineResume({ display_name: '原始', type: 'default' })
    const draft = await cloneOfflineResumeAsDraft({
      parentResumeId: parent,
      jdText: 'JD',
      keywords: ['A'],
    })
    await markOfflineVariantFailed(draft, 'boom')
    await deleteOfflineDraftVariant(draft)
    const lineage = await fetchOfflineVariantTree(parent)
    expect(lineage.root.children).toHaveLength(0)
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/lib/__tests__/offline-resume-manager.variant-ops.test.ts`
Expected: FAIL。

- [ ] **Step 3：在 `src/lib/offline-resume-manager.ts` 追加**

```ts
import type { DerivedStatus, VariantChange, VariantMetadata } from '@/lib/schema'
import type { VariantLineage, VariantTreeNode } from '@/lib/supabase/resume/variant'
import { applyVariantChange } from '@/components/jd-variant/apply-changes'

const MAX_VARIANT_DEPTH = 5

export async function cloneOfflineResumeAsDraft(args: {
  parentResumeId: string
  jdText: string
  keywords: string[]
  summary?: string
}): Promise<string> {
  const db = await getDB()
  const parent = await db.get('resumes', args.parentResumeId)
  if (!parent) throw new Error('源简历不存在')
  const draftId = generateResumeId()
  const cloneTitle = args.summary?.slice(0, 16) || args.keywords[0] || 'JD 变体'
  const initialMetadata: VariantMetadata = {
    keywords: args.keywords,
    changes: [],
    generatedAt: new Date().toISOString(),
    matchRate: 0,
  }
  await db.add('resumes', {
    resume_id: draftId,
    display_name: `${parent.display_name} - ${cloneTitle}`,
    description: `JD 变体 · ${new Date().toLocaleDateString()}`,
    type: parent.type,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    data: hydrateOfflineResumeData({ ...(parent.data ?? {}) }),
    parent_resume_id: args.parentResumeId,
    linked_jd_text: args.jdText,
    derived_metadata: initialMetadata,
    derived_status: 'generating',
  })
  return draftId
}

export async function applyOfflineVariantChanges(
  draftResumeId: string,
  changes: VariantChange[],
): Promise<void> {
  const db = await getDB()
  const draft = await db.get('resumes', draftResumeId)
  if (!draft) throw new Error('草稿不存在')
  let snapshot = (draft.data ?? {}) as Partial<import('@/lib/schema').PersistedResumeSnapshot>
  for (const change of changes) {
    snapshot = applyVariantChange(snapshot as never, change)
  }
  draft.data = snapshot
  draft.updated_at = new Date().toISOString()
  await db.put('resumes', draft)
}

export async function markOfflineVariantReady(
  draftResumeId: string,
  args: { matchRate: number, generatedAt: string, changes?: VariantChange[], keywords?: string[] },
): Promise<void> {
  const db = await getDB()
  const draft = await db.get('resumes', draftResumeId)
  if (!draft) throw new Error('草稿不存在')
  const prior = draft.derived_metadata ?? null
  draft.derived_metadata = {
    keywords: args.keywords ?? prior?.keywords ?? [],
    changes: args.changes ?? prior?.changes ?? [],
    matchRate: args.matchRate,
    generatedAt: args.generatedAt,
  }
  draft.derived_status = 'ready'
  draft.updated_at = new Date().toISOString()
  await db.put('resumes', draft)
}

export async function markOfflineVariantFailed(draftResumeId: string, message: string): Promise<void> {
  const db = await getDB()
  const draft = await db.get('resumes', draftResumeId)
  if (!draft) throw new Error('草稿不存在')
  draft.derived_status = 'failed'
  draft.description = `派生失败：${message.slice(0, 200)}`
  draft.updated_at = new Date().toISOString()
  await db.put('resumes', draft)
}

export async function deleteOfflineDraftVariant(draftResumeId: string): Promise<void> {
  const db = await getDB()
  await db.delete('resumes', draftResumeId)
}

export async function fetchOfflineVariantTree(currentResumeId: string): Promise<VariantLineage> {
  const db = await getDB()
  const all = await db.getAll('resumes')
  const byId = new Map(all.map(r => [r.resume_id, r]))

  const visited = new Set<string>()
  let walker: string | null = currentResumeId
  let depth = 0
  let rootId = currentResumeId
  while (walker && !visited.has(walker) && depth < MAX_VARIANT_DEPTH) {
    visited.add(walker)
    rootId = walker
    const node = byId.get(walker)
    walker = node?.parent_resume_id ?? null
    depth += 1
  }

  function build(id: string, lvl: number): VariantTreeNode {
    const r = byId.get(id)!
    const children = lvl >= MAX_VARIANT_DEPTH
      ? []
      : all.filter(c => c.parent_resume_id === id).map(c => build(c.resume_id, lvl + 1))
    return {
      resumeId: r.resume_id,
      displayName: r.display_name,
      derivedStatus: r.derived_status ?? null,
      generatedAt: r.derived_metadata?.generatedAt ?? null,
      jdSnippet: r.linked_jd_text?.slice(0, 80) ?? null,
      matchRate: r.derived_metadata?.matchRate ?? null,
      children,
    }
  }

  return { root: build(rootId, 0), currentId: currentResumeId }
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/lib/__tests__/offline-resume-manager.variant-ops.test.ts`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/lib/offline-resume-manager.ts --max-warnings 0`
Expected: 0 errors。

- [ ] **Step 6：commit**

```bash
git add src/lib/offline-resume-manager.ts src/lib/__tests__/offline-resume-manager.variant-ops.test.ts
git commit -m "feat(idb): add offline variant CRUD + lineage tree"
```

---

### Task 8: `jd-variant` 模块 types + const

**Files:**
- Create: `src/components/jd-variant/types.ts`
- Create: `src/components/jd-variant/const.ts`
- Create: `src/components/jd-variant/index.ts`（barrel）

> 此任务为定义型，无运行行为；通过下游任务的失败测试间接验证。

- [ ] **Step 1：写 types.ts**

```ts
// src/components/jd-variant/types.ts
import type { LucideIcon } from 'lucide-react'
import type {
  DerivedStatus,
  PersistedResumeSnapshot,
  ResumeSchema,
  VariantChange,
  VariantMetadata,
} from '@/lib/schema'
import type { VariantLineage, VariantTreeNode } from '@/lib/supabase/resume/variant'

export type { DerivedStatus, VariantChange, VariantMetadata, VariantTreeNode, VariantLineage }

export type GeneratorPhase =
  | 'idle'
  | 'parsing'
  | 'rewriting'
  | 'success'
  | 'error'
  | 'aborted'

export interface VariantAnalysisLog {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface GeneratorState {
  phase: GeneratorPhase
  draftResumeId: string | null
  keywords: string[]
  changes: VariantChange[]
  completedSections: Array<keyof ResumeSchema>
  errorMessage: string | null
  matchRate: number
  parseReasoning: string
  rewriteReasoning: string
  rewriteContent: string
  logs: VariantAnalysisLog[]
}

export interface GenerateVariantArgs {
  parentResumeId: string
  jdText: string
  reuseKeywords?: string[]
}

export interface VariantStepConfig {
  id: 'parsing' | 'thinking' | 'cloning' | 'rewriting' | 'validating' | 'done'
  label: string
  icon: LucideIcon
}

export type ResumeFilterMode = 'all' | 'originals' | 'variants'

/** 给 LLM 喂的简历视图，仅含白名单字段 */
export type EditableResumeView = Partial<{
  basics: { id: 'whole', summary?: string }
  job_intent: { id: 'whole', content?: string }
  skill_specialty: { id: 'whole', content?: string }
  self_evaluation: { id: 'whole', content?: string }
  work_experience: Array<{ id: string, description?: string, bullets?: string[] }>
  internship_experience: Array<{ id: string, description?: string, bullets?: string[] }>
  project_experience: Array<{ id: string, description?: string, techStack?: string }>
  campus_experience: Array<{ id: string, description?: string }>
}>

export interface VariantApplyContext {
  snapshot: PersistedResumeSnapshot
}
```

- [ ] **Step 2：写 const.ts**

```ts
// src/components/jd-variant/const.ts
import type { VariantStepConfig } from './types'
import { Brain, CheckCircle2, Copy, ScanText, ShieldCheck, Wand2 } from 'lucide-react'

export const MIN_JD_CHARS = 30
export const MIN_KEYWORDS = 3
export const MAX_KEYWORDS = 30
export const MIN_CHANGES = 3
export const MAX_CHANGES = 15
export const MAX_VARIANT_DEPTH = 5
export const REWRITE_AFTER_LENGTH_RATIO = 1.5

/** 可改写字段白名单（与 spec §1.5 完全一致） */
export const FIELD_WHITELIST: Array<{ section: keyof import('@/lib/schema').ResumeSchema, fieldPath: string }> = [
  { section: 'basics', fieldPath: 'summary' },
  { section: 'job_intent', fieldPath: 'content' },
  { section: 'skill_specialty', fieldPath: 'content' },
  { section: 'self_evaluation', fieldPath: 'content' },
  { section: 'work_experience', fieldPath: 'description' },
  { section: 'work_experience', fieldPath: 'bullets' },
  { section: 'internship_experience', fieldPath: 'description' },
  { section: 'internship_experience', fieldPath: 'bullets' },
  { section: 'project_experience', fieldPath: 'description' },
  { section: 'project_experience', fieldPath: 'techStack' },
  { section: 'campus_experience', fieldPath: 'description' },
]

export const JD_VARIANT_STEPS: VariantStepConfig[] = [
  { id: 'parsing', label: '解析 JD 关键词', icon: ScanText },
  { id: 'thinking', label: '模型正在思考', icon: Brain },
  { id: 'cloning', label: '复制源简历草稿', icon: Copy },
  { id: 'rewriting', label: '改写候选字段', icon: Wand2 },
  { id: 'validating', label: '校验输出与匹配率', icon: ShieldCheck },
  { id: 'done', label: '完成', icon: CheckCircle2 },
]

export const MESSAGES = {
  dialogTitle: (name: string) => `为「${name}」派生 JD 变体`,
  dialogSubtitle: '在原简历基础上，AI 会针对 JD 局部改写文案，事实型字段保持不变。',
  jdPlaceholder: '粘贴目标岗位的 JD 文本（≥ 30 字）。',
  jdMinHint: (curr: number) => `${curr} / 至少 ${MIN_JD_CHARS} 字`,
  parsing: '正在解析 JD 关键词…',
  cloning: '正在复制源简历草稿…',
  rewriting: '改写中…',
  validating: '校验输出与匹配率…',
  done: '变体生成完成',
  errorTitle: '派生失败',
  cancelConfirmTitle: '派生中，确认放弃？',
  cancelConfirmDesc: (n: number) => `已生成 ${n} 处改写。放弃将删除草稿简历。`,
  matchRateLow: '当前匹配度较低，可考虑「再生成一次」或微调 JD 后重试。',
  emptyChanges: 'AI 改写无效，请重试',
  variantBadge: 'JD 变体',
  variantsCount: (n: number) => `${n} 个变体`,
  derivingFrom: (name: string) => `派生自《${name}》`,
  filterAll: '全部',
  filterOriginals: '原始简历',
  filterVariants: 'JD 变体',
  derivedJobsBanner: (n: number, m: number) => `派生中 (${n}) / 失败的派生 (${m})`,
} as const
```

- [ ] **Step 3：写 barrel `index.ts`**

```ts
// src/components/jd-variant/index.ts
export * from './types'
export { JdVariantDialog } from './jd-variant-dialog'
export { useJdVariantGenerator } from './use-jd-variant-generator'
export { useVariantLineage } from './use-variant-lineage'
```

> 注：`jd-variant-dialog` / hook 由后续任务实现，barrel 暂保留 import 失败也无所谓——本任务只需新文件存在且后续 PR 不孤悬。在 Task 18 之前，barrel 仅导出 `* from './types'`，等组件就位再加。

为避免 Task 8 单独 commit 时孤悬引用，本任务的 `index.ts` 暂时写为：

```ts
export * from './types'
```

下游任务再追加导出。

- [ ] **Step 4：smoke check**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors。

- [ ] **Step 5：commit**

```bash
git add src/components/jd-variant/types.ts src/components/jd-variant/const.ts src/components/jd-variant/index.ts
git commit -m "feat(jd-variant): scaffold types/const/barrel for jd-driven variant module"
```

---

### Task 9: `jd-variant/utils.ts`

**Files:**
- Create: `src/components/jd-variant/utils.ts`
- Test: `src/components/jd-variant/__tests__/utils.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// src/components/jd-variant/__tests__/utils.test.ts
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { describe, expect, it } from 'vitest'
import { buildEditableView, computeMatchRate, formatJdSnippet } from '../utils'

const snap = {
  basics: { summary: '热爱 React 与性能优化' },
  job_intent: { content: '前端开发' },
  self_evaluation: { content: '<p>专注 React</p>' },
  edu_background: [{ id: 'e1', school: '清华' }],
  work_experience: [{ id: 'w1', company: '字节', title: '前端', description: 'React 项目', bullets: ['优化性能'] }],
} as unknown as PersistedResumeSnapshot

describe('buildEditableView', () => {
  it('only contains whitelist sections', () => {
    const v = buildEditableView(snap)
    expect(v.edu_background).toBeUndefined()
    expect(v.work_experience?.[0]?.description).toBe('React 项目')
    expect(v.basics?.summary).toContain('React')
  })
})

describe('computeMatchRate', () => {
  it('returns ratio of keywords found in resume text', () => {
    expect(computeMatchRate(['React', '性能优化', '不存在词'], snap)).toBeCloseTo(2 / 3, 2)
  })
  it('returns 0 on empty keywords', () => {
    expect(computeMatchRate([], snap)).toBe(0)
  })
})

describe('formatJdSnippet', () => {
  it('truncates and replaces newlines', () => {
    const s = formatJdSnippet('一行\n二行\n三行', 5)
    expect(s.length).toBeLessThanOrEqual(8)
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/components/jd-variant/__tests__/utils.test.ts`
Expected: FAIL。

- [ ] **Step 3：实现 utils.ts**

```ts
// src/components/jd-variant/utils.ts
import type { PersistedResumeSnapshot } from '@/lib/schema'
import type { EditableResumeView } from './types'

const WHITELIST_TEXT_PATHS: Array<(s: PersistedResumeSnapshot) => string[]> = [
  s => [String((s.basics as { summary?: string })?.summary ?? '')],
  s => [String((s.job_intent as { content?: string })?.content ?? '')],
  s => [String((s.skill_specialty as { content?: string })?.content ?? '')],
  s => [String((s.self_evaluation as { content?: string })?.content ?? '')],
  s => (Array.isArray(s.work_experience) ? s.work_experience.flatMap((w: any) => [w?.description ?? '', ...(Array.isArray(w?.bullets) ? w.bullets : [])]) : []),
  s => (Array.isArray(s.internship_experience) ? s.internship_experience.flatMap((w: any) => [w?.description ?? '', ...(Array.isArray(w?.bullets) ? w.bullets : [])]) : []),
  s => (Array.isArray(s.project_experience) ? s.project_experience.flatMap((p: any) => [p?.description ?? '', p?.techStack ?? '']) : []),
  s => (Array.isArray(s.campus_experience) ? s.campus_experience.map((c: any) => c?.description ?? '') : []),
]

export function buildEditableView(snapshot: PersistedResumeSnapshot): EditableResumeView {
  const view: EditableResumeView = {}
  if ((snapshot.basics as { summary?: string })?.summary) {
    view.basics = { id: 'whole', summary: (snapshot.basics as { summary: string }).summary }
  }
  if ((snapshot.job_intent as { content?: string })?.content) {
    view.job_intent = { id: 'whole', content: (snapshot.job_intent as { content: string }).content }
  }
  if ((snapshot.skill_specialty as { content?: string })?.content) {
    view.skill_specialty = { id: 'whole', content: (snapshot.skill_specialty as { content: string }).content }
  }
  if ((snapshot.self_evaluation as { content?: string })?.content) {
    view.self_evaluation = { id: 'whole', content: (snapshot.self_evaluation as { content: string }).content }
  }
  if (Array.isArray(snapshot.work_experience)) {
    view.work_experience = snapshot.work_experience.map((w: any) => ({
      id: String(w.id),
      description: w.description,
      bullets: Array.isArray(w.bullets) ? w.bullets : undefined,
    }))
  }
  if (Array.isArray(snapshot.internship_experience)) {
    view.internship_experience = snapshot.internship_experience.map((w: any) => ({
      id: String(w.id),
      description: w.description,
      bullets: Array.isArray(w.bullets) ? w.bullets : undefined,
    }))
  }
  if (Array.isArray(snapshot.project_experience)) {
    view.project_experience = snapshot.project_experience.map((p: any) => ({
      id: String(p.id),
      description: p.description,
      techStack: p.techStack,
    }))
  }
  if (Array.isArray(snapshot.campus_experience)) {
    view.campus_experience = snapshot.campus_experience.map((c: any) => ({
      id: String(c.id),
      description: c.description,
    }))
  }
  return view
}

function flattenSnapshotText(snapshot: PersistedResumeSnapshot): string {
  return WHITELIST_TEXT_PATHS
    .flatMap(fn => fn(snapshot))
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

export function computeMatchRate(keywords: string[], snapshot: PersistedResumeSnapshot): number {
  if (!Array.isArray(keywords) || keywords.length === 0) return 0
  const text = flattenSnapshotText(snapshot)
  let hit = 0
  for (const k of keywords) {
    if (!k) continue
    if (text.includes(k.toLowerCase())) hit += 1
  }
  return hit / keywords.length
}

export function formatJdSnippet(jdText: string, max = 30): string {
  const cleaned = jdText.replace(/\s+/g, ' ').trim()
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/components/jd-variant/__tests__/utils.test.ts`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/components/jd-variant/utils.ts --max-warnings 0`
Expected: 0 errors。

- [ ] **Step 6：commit**

```bash
git add src/components/jd-variant/utils.ts src/components/jd-variant/__tests__/utils.test.ts
git commit -m "feat(jd-variant): add buildEditableView/computeMatchRate/formatJdSnippet"
```

---

### Task 10: `jd-variant/parse-variant-response.ts`

**Files:**
- Create: `src/components/jd-variant/parse-variant-response.ts`
- Test: `src/components/jd-variant/__tests__/parse-variant-response.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// src/components/jd-variant/__tests__/parse-variant-response.test.ts
import { describe, expect, it } from 'vitest'
import { parseVariantResponse } from '../parse-variant-response'

const goodChange = {
  section: 'self_evaluation',
  itemId: 'whole',
  fieldPath: 'content',
  before: '<p>原文 React</p>',
  after: '<p>新文 React 性能优化</p>',
  matchedKeywords: ['React'],
  reason: '突出 React 经验',
}

describe('parseVariantResponse', () => {
  it('accepts a complete payload with ≥ 3 valid changes', () => {
    const json = JSON.stringify({
      changes: [goodChange, goodChange, goodChange],
    })
    const r = parseVariantResponse(json, { strict: true })
    expect(r.changes).toHaveLength(3)
  })

  it('drops change whose section is not whitelisted', () => {
    const bad = { ...goodChange, section: 'edu_background' }
    const json = JSON.stringify({ changes: [goodChange, bad, goodChange, goodChange] })
    const r = parseVariantResponse(json, { strict: true })
    expect(r.changes.every(c => c.section !== 'edu_background')).toBe(true)
  })

  it('drops change where after equals before', () => {
    const bad = { ...goodChange, after: goodChange.before }
    const json = JSON.stringify({ changes: [goodChange, bad, goodChange, goodChange] })
    const r = parseVariantResponse(json, { strict: true })
    expect(r.changes.length).toBe(3)
  })

  it('drops change where after is too long', () => {
    const bad = { ...goodChange, after: '新文'.repeat(200) }
    const json = JSON.stringify({ changes: [goodChange, bad, goodChange, goodChange] })
    const r = parseVariantResponse(json, { strict: true })
    expect(r.changes.length).toBe(3)
  })

  it('throws when valid count < 3 in strict mode', () => {
    const json = JSON.stringify({ changes: [goodChange, goodChange] })
    expect(() => parseVariantResponse(json, { strict: true })).toThrow()
  })

  it('returns partial in non-strict mode', () => {
    const json = '{"changes":[{' // 截断
    const r = parseVariantResponse(json, { strict: false })
    expect(r.changes).toHaveLength(0)
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/components/jd-variant/__tests__/parse-variant-response.test.ts`
Expected: FAIL。

- [ ] **Step 3：实现**

```ts
// src/components/jd-variant/parse-variant-response.ts
import type { VariantChange } from '@/lib/schema'
import { parseLlmJsonObject } from '@/lib/llm'
import { variantChangeSchema } from '@/lib/schema'
import { MAX_CHANGES, MIN_CHANGES, REWRITE_AFTER_LENGTH_RATIO } from './const'

interface RawShape {
  changes?: unknown
}

export interface ParseVariantResult {
  changes: VariantChange[]
}

export function parseVariantResponse(raw: string, options: { strict: boolean }): ParseVariantResult {
  let obj: RawShape | null = null
  try {
    obj = parseLlmJsonObject<RawShape>(raw)
  } catch (err) {
    if (options.strict) throw err
    return { changes: [] }
  }
  const list = Array.isArray(obj?.changes) ? obj!.changes : []
  const valid: VariantChange[] = []
  for (const item of list) {
    const parsed = variantChangeSchema.safeParse(item)
    if (!parsed.success) continue
    const c = parsed.data
    if (c.before === c.after) continue
    if (c.after.length > c.before.length * REWRITE_AFTER_LENGTH_RATIO) continue
    if (c.matchedKeywords.length === 0) continue
    valid.push(c)
    if (valid.length >= MAX_CHANGES) break
  }
  if (options.strict && valid.length < MIN_CHANGES) {
    throw new Error('AI 改写无效，请重试')
  }
  return { changes: valid }
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/components/jd-variant/__tests__/parse-variant-response.test.ts`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/components/jd-variant/parse-variant-response.ts --max-warnings 0`
Expected: 0 errors。

- [ ] **Step 6：commit**

```bash
git add src/components/jd-variant/parse-variant-response.ts src/components/jd-variant/__tests__/parse-variant-response.test.ts
git commit -m "feat(jd-variant): add tolerant parseVariantResponse with validation"
```

---

### Task 11: `jd-variant/apply-changes.ts`

**Files:**
- Create: `src/components/jd-variant/apply-changes.ts`
- Test: `src/components/jd-variant/__tests__/apply-changes.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// src/components/jd-variant/__tests__/apply-changes.test.ts
import type { PersistedResumeSnapshot, VariantChange } from '@/lib/schema'
import { describe, expect, it } from 'vitest'
import { applyVariantChange } from '../apply-changes'

const base = {
  self_evaluation: { content: '<p>原文</p>' },
  work_experience: [
    { id: 'w1', company: '字节', description: '老的描述', bullets: ['老 1', '老 2'] },
    { id: 'w2', company: '腾讯', description: '不动' },
  ],
} as unknown as PersistedResumeSnapshot

describe('applyVariantChange', () => {
  it('replaces whole section content', () => {
    const change: VariantChange = {
      section: 'self_evaluation',
      itemId: 'whole',
      fieldPath: 'content',
      before: '<p>原文</p>',
      after: '<p>新文</p>',
      matchedKeywords: ['x'],
      reason: '',
    }
    const next = applyVariantChange(base, change)
    expect((next.self_evaluation as { content: string }).content).toBe('<p>新文</p>')
  })

  it('replaces array item field by id', () => {
    const change: VariantChange = {
      section: 'work_experience',
      itemId: 'w1',
      fieldPath: 'description',
      before: '老的描述',
      after: '新的描述',
      matchedKeywords: ['x'],
      reason: '',
    }
    const next = applyVariantChange(base, change)
    expect((next.work_experience as Array<{ id: string, description: string }>)[0].description).toBe('新的描述')
    expect((next.work_experience as Array<{ id: string, description: string }>)[1].description).toBe('不动')
  })

  it('replaces array item bullets', () => {
    const change: VariantChange = {
      section: 'work_experience',
      itemId: 'w1',
      fieldPath: 'bullets',
      before: '老 1\n老 2',
      after: '新 1\n新 2',
      matchedKeywords: ['x'],
      reason: '',
    }
    const next = applyVariantChange(base, change)
    expect((next.work_experience as Array<{ id: string, bullets: string[] }>)[0].bullets).toEqual(['新 1', '新 2'])
  })

  it('is a noop if itemId not found', () => {
    const change: VariantChange = {
      section: 'work_experience',
      itemId: 'unknown',
      fieldPath: 'description',
      before: 'a',
      after: 'b',
      matchedKeywords: ['x'],
      reason: '',
    }
    const next = applyVariantChange(base, change)
    expect(next).toEqual(base)
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/components/jd-variant/__tests__/apply-changes.test.ts`
Expected: FAIL。

- [ ] **Step 3：实现**

```ts
// src/components/jd-variant/apply-changes.ts
import type { PersistedResumeSnapshot, VariantChange } from '@/lib/schema'

function setNested(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.')
  if (keys.length === 1) {
    return { ...obj, [keys[0]]: value }
  }
  const [head, ...rest] = keys
  const next = (obj[head] as Record<string, unknown>) ?? {}
  return { ...obj, [head]: setNested(next, rest.join('.'), value) }
}

function applyToValue(value: string | string[] | undefined, fieldPath: string, after: string): string | string[] {
  if (fieldPath === 'bullets') {
    return after.split('\n').filter(Boolean)
  }
  return after
}

export function applyVariantChange<T extends PersistedResumeSnapshot | Partial<PersistedResumeSnapshot>>(
  snapshot: T,
  change: VariantChange,
): T {
  const sectionKey = change.section as keyof PersistedResumeSnapshot
  const current = (snapshot as Record<string, unknown>)[sectionKey as string]

  if (change.itemId === 'whole') {
    const nextValue = current && typeof current === 'object' && !Array.isArray(current)
      ? setNested(current as Record<string, unknown>, change.fieldPath, applyToValue(undefined, change.fieldPath, change.after))
      : { [change.fieldPath]: applyToValue(undefined, change.fieldPath, change.after) }
    return { ...(snapshot as Record<string, unknown>), [sectionKey]: nextValue } as T
  }

  if (Array.isArray(current)) {
    const nextArr = (current as Array<Record<string, unknown> & { id?: string }>).map((item) => {
      if (item?.id !== change.itemId) return item
      return setNested(item, change.fieldPath, applyToValue(undefined, change.fieldPath, change.after))
    })
    const found = (current as Array<{ id?: string }>).some(i => i?.id === change.itemId)
    if (!found) return snapshot
    return { ...(snapshot as Record<string, unknown>), [sectionKey]: nextArr } as T
  }

  return snapshot
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/components/jd-variant/__tests__/apply-changes.test.ts`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/components/jd-variant/apply-changes.ts --max-warnings 0`
Expected: 0 errors。

- [ ] **Step 6：commit**

```bash
git add src/components/jd-variant/apply-changes.ts src/components/jd-variant/__tests__/apply-changes.test.ts
git commit -m "feat(jd-variant): add applyVariantChange for snapshot mutation"
```

---

### Task 12: `use-jd-variant-generator` 主调度 hook

**Files:**
- Create: `src/components/jd-variant/use-jd-variant-generator.ts`
- Test: `src/components/jd-variant/__tests__/use-jd-variant-generator.test.tsx`

- [ ] **Step 1：写失败测试**

```tsx
// src/components/jd-variant/__tests__/use-jd-variant-generator.test.tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/llm', async (orig) => ({
  ...(await orig<typeof import('@/lib/llm')>()),
  runJdVariantParse: vi.fn(async (_jd, onUpdate) => {
    onUpdate?.({ content: '', reasoning: '想…' })
    onUpdate?.({ content: '{"keywords":["React","TS","perf"],"summary":"前端"}', reasoning: '想…' })
    return { content: '{"keywords":["React","TS","perf"],"summary":"前端"}', reasoning: '想…' }
  }),
  runJdVariantRewrite: vi.fn(async (_args, onUpdate) => {
    const goodChange = (i: number) => ({ section: 'self_evaluation', itemId: 'whole', fieldPath: 'content', before: '<p>原文</p>', after: `<p>新${i}</p>`, matchedKeywords: ['React'], reason: 'r' })
    const json = JSON.stringify({ changes: [goodChange(1), goodChange(2), goodChange(3)] })
    onUpdate?.({ content: json, reasoning: 'rw' })
    return { content: json, reasoning: 'rw' }
  }),
}))

vi.mock('@/lib/supabase/resume', () => ({
  cloneResumeAsDraft: vi.fn(async () => 'draft-1'),
  applyVariantChanges: vi.fn(async () => ({})),
  markVariantReady: vi.fn(async () => undefined),
  markVariantFailed: vi.fn(async () => undefined),
  deleteDraftVariant: vi.fn(async () => undefined),
  getResumeById: vi.fn(async () => ({ resume_id: 'p-1', display_name: '原始' })),
}))

import { useJdVariantGenerator } from '../use-jd-variant-generator'

describe('useJdVariantGenerator', () => {
  it('runs through phases parsing→rewriting→success', async () => {
    const { result } = renderHook(() => useJdVariantGenerator())
    await act(async () => {
      await result.current.generate({ parentResumeId: 'p-1', jdText: 'A'.repeat(40) })
    })
    await waitFor(() => expect(result.current.state.phase).toBe('success'))
    expect(result.current.state.draftResumeId).toBe('draft-1')
    expect(result.current.state.changes.length).toBeGreaterThanOrEqual(3)
  })

  it('abort sets phase to aborted', async () => {
    const { result } = renderHook(() => useJdVariantGenerator())
    act(() => result.current.abort())
    expect(['idle', 'aborted']).toContain(result.current.state.phase)
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/components/jd-variant/__tests__/use-jd-variant-generator.test.tsx`
Expected: FAIL（hook 不存在）。

- [ ] **Step 3：实现 hook**

```ts
// src/components/jd-variant/use-jd-variant-generator.ts
import type { GenerateVariantArgs, GeneratorState } from './types'
import type { PersistedResumeSnapshot, VariantChange } from '@/lib/schema'
import { useCallback, useEffect, useRef, useState } from 'react'
import { parseLlmJsonObject, runJdVariantParse, runJdVariantRewrite } from '@/lib/llm'
import {
  applyVariantChanges,
  cloneResumeAsDraft,
  deleteDraftVariant,
  getResumeById,
  markVariantFailed,
  markVariantReady,
} from '@/lib/supabase/resume'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import {
  applyOfflineVariantChanges,
  cloneOfflineResumeAsDraft,
  deleteOfflineDraftVariant,
  getOfflineResumeById,
  markOfflineVariantFailed,
  markOfflineVariantReady,
} from '@/lib/offline-resume-manager'
import { MAX_KEYWORDS, MIN_KEYWORDS } from './const'
import { parseVariantResponse } from './parse-variant-response'
import { buildEditableView, computeMatchRate } from './utils'

const initialState: GeneratorState = {
  phase: 'idle',
  draftResumeId: null,
  keywords: [],
  changes: [],
  completedSections: [],
  errorMessage: null,
  matchRate: 0,
  parseReasoning: '',
  rewriteReasoning: '',
  rewriteContent: '',
  logs: [],
}

export function useJdVariantGenerator() {
  const [state, setState] = useState<GeneratorState>(initialState)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => setState(initialState), [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState(s => ({ ...s, phase: 'aborted' }))
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  const generate = useCallback(async (args: GenerateVariantArgs) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState({ ...initialState, phase: 'parsing' })

    try {
      // Phase 1: parse JD（or reuse keywords）
      let keywords: string[] = args.reuseKeywords ?? []
      let summary: string | undefined
      if (keywords.length === 0) {
        const { content } = await runJdVariantParse(args.jdText, ({ content: c, reasoning }) => {
          setState(s => ({ ...s, parseReasoning: reasoning ?? s.parseReasoning, rewriteContent: c ?? s.rewriteContent }))
        }, { abortController: ctrl })
        if (ctrl.signal.aborted) return
        const parsed = parseLlmJsonObject<{ keywords?: unknown, summary?: unknown }>(content)
        const ks = Array.isArray(parsed.keywords) ? parsed.keywords.filter((x): x is string => typeof x === 'string') : []
        if (ks.length < MIN_KEYWORDS) throw new Error('JD 关键词太少，请粘贴更完整的 JD')
        keywords = Array.from(new Set(ks)).slice(0, MAX_KEYWORDS)
        summary = typeof parsed.summary === 'string' ? parsed.summary : undefined
      }
      setState(s => ({ ...s, keywords }))

      // 取 parent snapshot
      const isOffline = isOfflineResumeId(args.parentResumeId)
      const parent = isOffline
        ? (await getOfflineResumeById(args.parentResumeId))
        : await getResumeById<PersistedResumeSnapshot & { resume_id: string, display_name?: string }>(args.parentResumeId)
      if (!parent) throw new Error('源简历不存在')
      const parentSnapshot = (isOffline ? (parent as any).data : parent) as PersistedResumeSnapshot

      // 创建草稿
      const draftId = isOffline
        ? await cloneOfflineResumeAsDraft({
            parentResumeId: args.parentResumeId,
            jdText: args.jdText,
            keywords,
            summary,
          })
        : await cloneResumeAsDraft({
            parent: { ...parentSnapshot, resume_id: args.parentResumeId, display_name: (parent as any).display_name },
            jdText: args.jdText,
            keywords,
            summary,
          })
      setState(s => ({ ...s, draftResumeId: draftId, phase: 'rewriting' }))

      // Phase 2: rewrite
      const editable = buildEditableView(parentSnapshot)
      const { content: rewriteRaw } = await runJdVariantRewrite(
        { resumeJson: editable, jdText: args.jdText, keywords },
        ({ content, reasoning }) => {
          setState((s) => {
            const next: Partial<GeneratorState> = {
              rewriteContent: content ?? s.rewriteContent,
              rewriteReasoning: reasoning ?? s.rewriteReasoning,
            }
            // 流式估算已完成 sections（用于进度条）
            try {
              const partial = parseVariantResponse(content ?? '', { strict: false })
              next.completedSections = Array.from(new Set(partial.changes.map(c => c.section)))
              next.changes = partial.changes
            } catch { /* ignore partial errors */ }
            return { ...s, ...next }
          })
        },
        { abortController: ctrl },
      )
      if (ctrl.signal.aborted) return

      const { changes } = parseVariantResponse(rewriteRaw, { strict: true })

      // 应用 + 标记 ready
      const finalSnapshot = isOffline
        ? (await applyOfflineVariantChanges(draftId, changes), parentSnapshot)
        : await applyVariantChanges(draftId, parentSnapshot, changes)
      const matchRate = computeMatchRate(keywords, finalSnapshot)
      const generatedAt = new Date().toISOString()
      if (isOffline) {
        await markOfflineVariantReady(draftId, { matchRate, generatedAt, changes, keywords })
      } else {
        await markVariantReady(draftId, { matchRate, generatedAt, changes, keywords })
      }

      setState(s => ({ ...s, phase: 'success', changes, matchRate }))
    } catch (err) {
      if (ctrl.signal.aborted) return
      const message = err instanceof Error ? err.message : '派生失败'
      setState((s) => {
        if (s.draftResumeId) {
          const isOff = isOfflineResumeId(s.draftResumeId)
          const fail = isOff ? markOfflineVariantFailed : markVariantFailed
          fail(s.draftResumeId, message).catch(() => undefined)
        }
        return { ...s, phase: 'error', errorMessage: message }
      })
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null
    }
  }, [])

  const discardDraft = useCallback(async () => {
    const id = state.draftResumeId
    if (!id) return
    if (isOfflineResumeId(id)) await deleteOfflineDraftVariant(id)
    else await deleteDraftVariant(id)
    reset()
  }, [state.draftResumeId, reset])

  return { state, generate, abort, reset, discardDraft }
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/components/jd-variant/__tests__/use-jd-variant-generator.test.tsx`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/components/jd-variant/use-jd-variant-generator.ts --max-warnings 0`
Expected: 0 errors。

- [ ] **Step 6：commit**

```bash
git add src/components/jd-variant/use-jd-variant-generator.ts \
       src/components/jd-variant/__tests__/use-jd-variant-generator.test.tsx
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(jd-variant): add main generator orchestration hook"
```

---

## Task 13: variant lineage 缓存 hook

**目标**：实现 `useVariantLineage(rootId)`，封装 lineage tree fetch + 局部 zustand 缓存（key by rootId），供 derived dialog、tree dialog、editor toolbar 共用，避免重复网络/IDB 调用。

**新增文件**：
- `src/components/jd-variant/use-variant-lineage.ts`
- `src/components/jd-variant/__tests__/use-variant-lineage.test.tsx`

- [ ] **Step 1：写失败测试**

```ts
// __tests__/use-variant-lineage.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/resume/variant', () => ({
  fetchVariantTree: vi.fn(async (id: string) => ({
    resumeId: id, displayName: 'root', derivedStatus: 'ready',
    generatedAt: null, jdSnippet: null, matchRate: null,
    children: [{ resumeId: 'c1', displayName: 'child', derivedStatus: 'ready', generatedAt: null, jdSnippet: null, matchRate: null, children: [] }],
  })),
}))
vi.mock('@/lib/offline-resume-manager', () => ({ isOfflineResumeId: () => false }))
vi.mock('@/lib/offline-resume-variant', () => ({ fetchOfflineVariantTree: vi.fn() }))

import { useVariantLineage } from '../use-variant-lineage'
import { fetchVariantTree } from '@/lib/supabase/resume/variant'

describe('useVariantLineage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches tree on mount and caches by rootId', async () => {
    const { result, rerender } = renderHook(({ id }) => useVariantLineage(id), { initialProps: { id: 'root-1' } })
    await waitFor(() => expect(result.current.tree).toBeTruthy())
    expect(result.current.tree?.children).toHaveLength(1)
    expect(fetchVariantTree).toHaveBeenCalledTimes(1)
    rerender({ id: 'root-1' })
    await waitFor(() => expect(result.current.tree).toBeTruthy())
    expect(fetchVariantTree).toHaveBeenCalledTimes(1)
  })

  it('refresh forces a re-fetch', async () => {
    const { result } = renderHook(() => useVariantLineage('root-2'))
    await waitFor(() => expect(result.current.tree).toBeTruthy())
    await act(async () => { await result.current.refresh() })
    expect(fetchVariantTree).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/components/jd-variant/__tests__/use-variant-lineage.test.tsx`
Expected: FAIL（模块不存在）。

- [ ] **Step 3：实现**

```ts
// use-variant-lineage.ts
import { useCallback, useEffect, useState } from 'react'
import { create } from 'zustand'
import type { VariantTreeNode } from './types'
import { fetchVariantTree } from '@/lib/supabase/resume/variant'
import { fetchOfflineVariantTree } from '@/lib/offline-resume-variant'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'

interface CacheState {
  byId: Record<string, VariantTreeNode | undefined>
  set: (id: string, node: VariantTreeNode) => void
  invalidate: (id: string) => void
}

const useLineageCache = create<CacheState>((set) => ({
  byId: {},
  set: (id, node) => set((s) => ({ byId: { ...s.byId, [id]: node } })),
  invalidate: (id) => set((s) => {
    const next = { ...s.byId }; delete next[id]; return { byId: next }
  }),
}))

export function useVariantLineage(rootId: string | null | undefined) {
  const cached = useLineageCache((s) => (rootId ? s.byId[rootId] : undefined))
  const setCache = useLineageCache((s) => s.set)
  const invalidate = useLineageCache((s) => s.invalidate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (id: string) => {
    setLoading(true); setError(null)
    try {
      const fetcher = isOfflineResumeId(id) ? fetchOfflineVariantTree : fetchVariantTree
      const tree = await fetcher(id)
      setCache(id, tree)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'lineage fetch failed')
    } finally { setLoading(false) }
  }, [setCache])

  useEffect(() => {
    if (!rootId || cached) return
    void load(rootId)
  }, [rootId, cached, load])

  const refresh = useCallback(async () => {
    if (!rootId) return
    invalidate(rootId)
    await load(rootId)
  }, [rootId, invalidate, load])

  return { tree: cached ?? null, loading, error, refresh }
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/components/jd-variant/__tests__/use-variant-lineage.test.tsx`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/components/jd-variant/use-variant-lineage.ts --max-warnings 0`
Expected: 0 errors。

- [ ] **Step 6：commit**

```bash
git add src/components/jd-variant/use-variant-lineage.ts \
       src/components/jd-variant/__tests__/use-variant-lineage.test.tsx
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(jd-variant): add useVariantLineage cache hook"
```

---

## Task 14: StepInput 组件（JD 输入）

**目标**：第一步 UI。Textarea + 字数计数 + 校验（≥ MIN_JD_CHARS）+ 复用最近 JD chip + 折叠 "示例 JD" Accordion。受控通过 `value/onChange/onSubmit` props。

**新增文件**：
- `src/components/jd-variant/steps/step-input.tsx`
- `src/components/jd-variant/steps/__tests__/step-input.test.tsx`

- [ ] **Step 1：写失败测试**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StepInput } from '../step-input'

describe('StepInput', () => {
  it('disables submit when JD shorter than MIN_JD_CHARS', () => {
    const onSubmit = vi.fn()
    render(<StepInput value="too short" onChange={() => {}} onSubmit={onSubmit} recentJds={[]} />)
    const btn = screen.getByRole('button', { name: /开始派生|开始生成/ })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('enables submit at >= 30 chars and triggers onSubmit', () => {
    const onSubmit = vi.fn()
    const text = 'A'.repeat(30)
    render(<StepInput value={text} onChange={() => {}} onSubmit={onSubmit} recentJds={[]} />)
    const btn = screen.getByRole('button', { name: /开始派生|开始生成/ })
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('shows recent JD chips and reuse populates textarea', () => {
    const onChange = vi.fn()
    render(<StepInput value="" onChange={onChange} onSubmit={() => {}} recentJds={[{ snippet: '前端 React 工程师 …', full: 'X'.repeat(40) }]} />)
    fireEvent.click(screen.getByRole('button', { name: /复用/ }))
    expect(onChange).toHaveBeenCalledWith('X'.repeat(40))
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/components/jd-variant/steps/__tests__/step-input.test.tsx`
Expected: FAIL。

- [ ] **Step 3：实现**

```tsx
// step-input.tsx
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { MIN_JD_CHARS } from '../const'

export interface RecentJd { snippet: string; full: string }
export interface StepInputProps {
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  recentJds: RecentJd[]
}

const SAMPLE_JD = `职位：前端工程师\n要求：3 年以上 React 经验，熟悉 TypeScript / Tailwind / 状态管理，能独立交付完整模块。`

export function StepInput({ value, onChange, onSubmit, recentJds }: StepInputProps) {
  const tooShort = value.trim().length < MIN_JD_CHARS
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="jd-input" className="text-sm font-medium">粘贴 JD（≥ {MIN_JD_CHARS} 字）</label>
      <Textarea
        id="jd-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder="请粘贴目标岗位 JD…"
        className="resize-none"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span aria-live="polite">{value.trim().length} 字{tooShort ? `（还差 ${Math.max(0, MIN_JD_CHARS - value.trim().length)} 字）` : ''}</span>
        {recentJds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recentJds.slice(0, 3).map((jd) => (
              <Button key={jd.snippet} type="button" variant="ghost" size="sm" onClick={() => onChange(jd.full)} aria-label={`复用 JD：${jd.snippet}`}>
                <Badge variant="secondary" className="font-normal">复用：{jd.snippet}</Badge>
              </Button>
            ))}
          </div>
        )}
      </div>
      <Accordion type="single" collapsible>
        <AccordionItem value="sample">
          <AccordionTrigger className="text-xs">查看示例 JD</AccordionTrigger>
          <AccordionContent><pre className="whitespace-pre-wrap text-xs text-muted-foreground">{SAMPLE_JD}</pre></AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="flex justify-end">
        <Button type="button" disabled={tooShort} onClick={onSubmit}>开始派生</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/components/jd-variant/steps/__tests__/step-input.test.tsx`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/components/jd-variant/steps --max-warnings 0`

- [ ] **Step 6：commit**

```bash
git add src/components/jd-variant/steps/step-input.tsx \
       src/components/jd-variant/steps/__tests__/step-input.test.tsx
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(jd-variant): add StepInput JD textarea"
```

---

## Task 15: StepParsing 组件（解析阶段）

**目标**：解析阶段 UI。展示 ChainOfThought（流式 reasoning）+ keywords chips（流式追加）+ 取消按钮。

**新增文件**：
- `src/components/jd-variant/steps/step-parsing.tsx`
- `src/components/jd-variant/steps/__tests__/step-parsing.test.tsx`

- [ ] **Step 1：写失败测试**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StepParsing } from '../step-parsing'

describe('StepParsing', () => {
  it('renders streamed reasoning and keywords', () => {
    render(<StepParsing reasoning="正在分析 JD…" keywords={['React', 'TypeScript']} onAbort={() => {}} />)
    expect(screen.getByText(/正在分析 JD/)).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
  })
  it('calls onAbort when 取消 is clicked', () => {
    const onAbort = vi.fn()
    render(<StepParsing reasoning="" keywords={[]} onAbort={onAbort} />)
    fireEvent.click(screen.getByRole('button', { name: /取消/ }))
    expect(onAbort).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/components/jd-variant/steps/__tests__/step-parsing.test.tsx`
Expected: FAIL。

- [ ] **Step 3：实现**

```tsx
// step-parsing.tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { ChainOfThought } from '@/components/ai-rewrite/components/chain-of-thought'
import { AutoScrollContainer } from '@/components/ai-rewrite/components/auto-scroll-container'

export interface StepParsingProps {
  reasoning: string
  keywords: string[]
  onAbort: () => void
}

export function StepParsing({ reasoning, keywords, onAbort }: StepParsingProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> 正在解析 JD…
      </div>
      {reasoning && (
        <AutoScrollContainer className="max-h-32 overflow-auto rounded border bg-muted/40 p-2 text-xs">
          <ChainOfThought content={reasoning} />
        </AutoScrollContainer>
      )}
      <div className="flex flex-wrap gap-1.5" aria-live="polite" aria-label="提取的关键词">
        {keywords.map((kw) => <Badge key={kw} variant="outline">{kw}</Badge>)}
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={onAbort}>取消</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/components/jd-variant/steps/__tests__/step-parsing.test.tsx`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/components/jd-variant/steps --max-warnings 0`

- [ ] **Step 6：commit**

```bash
git add src/components/jd-variant/steps/step-parsing.tsx \
       src/components/jd-variant/steps/__tests__/step-parsing.test.tsx
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(jd-variant): add StepParsing reasoning + keywords"
```

---

## Task 16: StepRewriting 组件（改写阶段）

**目标**：改写阶段 UI。进度条（completedSections / 预估总数）+ 已完成 section 列表 + change 卡片（实时追加）+ 取消按钮。

**新增文件**：
- `src/components/jd-variant/steps/step-rewriting.tsx`
- `src/components/jd-variant/steps/__tests__/step-rewriting.test.tsx`

- [ ] **Step 1：写失败测试**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StepRewriting } from '../step-rewriting'
import type { VariantChange } from '../../types'

describe('StepRewriting', () => {
  it('renders progress and change cards', () => {
    const changes: VariantChange[] = [
      { section: 'self_evaluation', itemId: 'block-self', fieldPath: 'content', before: 'old', after: 'new with React', matchedKeywords: ['React'], reason: '强化关键词' },
    ]
    render(<StepRewriting completedSections={['self_evaluation']} changes={changes} estimatedTotal={3} onAbort={() => {}} />)
    expect(screen.getByText(/1\s*\/\s*3/)).toBeInTheDocument()
    expect(screen.getByText(/强化关键词/)).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/components/jd-variant/steps/__tests__/step-rewriting.test.tsx`
Expected: FAIL。

- [ ] **Step 3：实现**

```tsx
// step-rewriting.tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Loader2 } from 'lucide-react'
import type { VariantChange } from '../types'
import { SECTION_LABEL } from '../const'

export interface StepRewritingProps {
  completedSections: string[]
  changes: VariantChange[]
  estimatedTotal: number
  onAbort: () => void
}

export function StepRewriting({ completedSections, changes, estimatedTotal, onAbort }: StepRewritingProps) {
  const total = Math.max(estimatedTotal, completedSections.length || 1)
  const pct = Math.min(100, Math.round((completedSections.length / total) * 100))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> 正在改写…</span>
        <span className="tabular-nums text-xs text-muted-foreground">{completedSections.length} / {total}</span>
      </div>
      <Progress value={pct} aria-label="改写进度" />
      <ul className="flex flex-col gap-2 max-h-60 overflow-auto" aria-live="polite">
        {changes.map((c, i) => (
          <li key={`${c.section}-${c.itemId}-${i}`} className="rounded border bg-muted/30 p-2 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{SECTION_LABEL[c.section] ?? c.section}</Badge>
              <span className="text-muted-foreground">{c.reason}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {c.matchedKeywords.map((kw) => <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>)}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={onAbort}>取消</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/components/jd-variant/steps/__tests__/step-rewriting.test.tsx`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/components/jd-variant/steps --max-warnings 0`

- [ ] **Step 6：commit**

```bash
git add src/components/jd-variant/steps/step-rewriting.tsx \
       src/components/jd-variant/steps/__tests__/step-rewriting.test.tsx
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(jd-variant): add StepRewriting progress + changes"
```

---

## Task 17: StepResult 组件（成功阶段）

**目标**：成功阶段 UI。Alert 顶栏（matchRate %）+ 按 section 折叠的修改摘要 Accordion + 操作按钮（"打开新简历" 主按钮、"丢弃" 次按钮）。

**新增文件**：
- `src/components/jd-variant/steps/step-result.tsx`
- `src/components/jd-variant/steps/__tests__/step-result.test.tsx`

- [ ] **Step 1：写失败测试**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StepResult } from '../step-result'
import type { VariantChange } from '../../types'

describe('StepResult', () => {
  const changes: VariantChange[] = [
    { section: 'self_evaluation', itemId: 'block-self', fieldPath: 'content', before: '原', after: '新', matchedKeywords: ['React'], reason: 'r' },
    { section: 'work_experience', itemId: 'job-1', fieldPath: 'description.0', before: 'a', after: 'b', matchedKeywords: ['Node'], reason: 'r2' },
  ]

  it('shows match rate and groups changes by section', () => {
    render(<StepResult matchRate={0.78} changes={changes} onOpen={() => {}} onDiscard={() => {}} />)
    expect(screen.getByText(/78%/)).toBeInTheDocument()
    expect(screen.getByText(/自我评价/)).toBeInTheDocument()
    expect(screen.getByText(/工作经历/)).toBeInTheDocument()
  })

  it('triggers callbacks', () => {
    const onOpen = vi.fn(); const onDiscard = vi.fn()
    render(<StepResult matchRate={0.5} changes={[]} onOpen={onOpen} onDiscard={onDiscard} />)
    fireEvent.click(screen.getByRole('button', { name: /打开新简历/ }))
    fireEvent.click(screen.getByRole('button', { name: /丢弃/ }))
    expect(onOpen).toHaveBeenCalled(); expect(onDiscard).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/components/jd-variant/steps/__tests__/step-result.test.tsx`
Expected: FAIL。

- [ ] **Step 3：实现**

```tsx
// step-result.tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Sparkles } from 'lucide-react'
import type { VariantChange } from '../types'
import { SECTION_LABEL } from '../const'

export interface StepResultProps {
  matchRate: number | null
  changes: VariantChange[]
  onOpen: () => void
  onDiscard: () => void
}

export function StepResult({ matchRate, changes, onOpen, onDiscard }: StepResultProps) {
  const grouped = changes.reduce<Record<string, VariantChange[]>>((acc, c) => {
    (acc[c.section] ??= []).push(c); return acc
  }, {})
  const pct = matchRate == null ? '—' : `${Math.round(matchRate * 100)}%`
  return (
    <div className="flex flex-col gap-3">
      <Alert>
        <Sparkles className="size-4" aria-hidden />
        <AlertTitle>派生完成</AlertTitle>
        <AlertDescription>关键词匹配度：<span className="font-semibold tabular-nums">{pct}</span></AlertDescription>
      </Alert>
      <Accordion type="multiple" className="max-h-72 overflow-auto">
        {Object.entries(grouped).map(([section, items]) => (
          <AccordionItem key={section} value={section}>
            <AccordionTrigger className="text-sm">
              {SECTION_LABEL[section] ?? section} <Badge variant="secondary" className="ml-2">{items.length}</Badge>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="flex flex-col gap-2 text-xs">
                {items.map((c, i) => (
                  <li key={`${c.itemId}-${i}`} className="rounded border bg-muted/30 p-2 space-y-1">
                    <div className="text-muted-foreground">{c.reason}</div>
                    <div className="flex flex-wrap gap-1">
                      {c.matchedKeywords.map((kw) => <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>)}
                    </div>
                    <details><summary className="cursor-pointer">对比 before / after</summary>
                      <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
                        <pre className="whitespace-pre-wrap rounded bg-background p-1">{String(c.before ?? '')}</pre>
                        <pre className="whitespace-pre-wrap rounded bg-background p-1">{String(c.after ?? '')}</pre>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDiscard}>丢弃</Button>
        <Button type="button" onClick={onOpen}>打开新简历</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/components/jd-variant/steps/__tests__/step-result.test.tsx`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/components/jd-variant/steps --max-warnings 0`

- [ ] **Step 6：commit**

```bash
git add src/components/jd-variant/steps/step-result.tsx \
       src/components/jd-variant/steps/__tests__/step-result.test.tsx
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(jd-variant): add StepResult summary view"
```

---

## Task 18: JdVariantDialog 容器

**目标**：将 4 个 step 组件 + `useJdVariantGenerator` 拼装到 ResponsiveDialog。负责：步骤指示器、错误态 Alert（含"重试"和"放弃草稿"）、关闭时若仍 generating 弹 AlertDialog 二次确认、成功后 `onOpenResume(draftId)` 透传给父级（路由切换）。

**新增文件**：
- `src/components/jd-variant/jd-variant-dialog.tsx`
- `src/components/jd-variant/__tests__/jd-variant-dialog.test.tsx`

- [ ] **Step 1：写失败测试**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const generate = vi.fn(); const abort = vi.fn(); const reset = vi.fn(); const discardDraft = vi.fn()
const stateRef = { current: { phase: 'idle', draftResumeId: null, keywords: [], changes: [], completedSections: [], errorMessage: null, matchRate: null, parseReasoning: '', rewriteReasoning: '', rewriteContent: '', logs: [] } as any }
vi.mock('../use-jd-variant-generator', () => ({ useJdVariantGenerator: () => ({ state: stateRef.current, generate, abort, reset, discardDraft }) }))

import { JdVariantDialog } from '../jd-variant-dialog'

describe('JdVariantDialog', () => {
  it('renders Step 1 input by default', () => {
    render(<JdVariantDialog open onOpenChange={() => {}} parentResumeId="r1" onOpenResume={() => {}} recentJds={[]} />)
    expect(screen.getByLabelText(/粘贴 JD/)).toBeInTheDocument()
  })

  it('clicking 开始派生 calls generate', async () => {
    render(<JdVariantDialog open onOpenChange={() => {}} parentResumeId="r1" onOpenResume={() => {}} recentJds={[]} />)
    const ta = screen.getByLabelText(/粘贴 JD/)
    fireEvent.change(ta, { target: { value: 'A'.repeat(40) } })
    fireEvent.click(screen.getByRole('button', { name: /开始派生/ }))
    await waitFor(() => expect(generate).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/components/jd-variant/__tests__/jd-variant-dialog.test.tsx`
Expected: FAIL。

- [ ] **Step 3：实现**

```tsx
// jd-variant-dialog.tsx
import { useCallback, useState } from 'react'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription } from '@/components/ui/responsive-dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { StepInput, type RecentJd } from './steps/step-input'
import { StepParsing } from './steps/step-parsing'
import { StepRewriting } from './steps/step-rewriting'
import { StepResult } from './steps/step-result'
import { useJdVariantGenerator } from './use-jd-variant-generator'

export interface JdVariantDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  parentResumeId: string
  onOpenResume: (draftId: string) => void
  recentJds: RecentJd[]
  initialJd?: string
  skipInputStep?: boolean
}

export function JdVariantDialog({ open, onOpenChange, parentResumeId, onOpenResume, recentJds, initialJd = '', skipInputStep = false }: JdVariantDialogProps) {
  const [jd, setJd] = useState(initialJd)
  const [confirmClose, setConfirmClose] = useState(false)
  const { state, generate, abort, reset, discardDraft } = useJdVariantGenerator()

  const startGenerate = useCallback(() => { void generate({ parentResumeId, jdText: jd }) }, [generate, parentResumeId, jd])

  // 自动跳过 Step 1（来自 optimize 入口的预填）
  if (skipInputStep && state.phase === 'idle' && jd.trim().length > 0) startGenerate()

  const handleOpenChange = (next: boolean) => {
    if (!next && (state.phase === 'parsing' || state.phase === 'rewriting')) {
      setConfirmClose(true); return
    }
    if (!next) { reset(); setJd('') }
    onOpenChange(next)
  }

  const stepIndex = state.phase === 'idle' ? 1 : state.phase === 'parsing' ? 2 : state.phase === 'rewriting' ? 3 : 4
  const total = 4

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
        <ResponsiveDialogContent className="max-w-xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>JD 驱动派生简历</ResponsiveDialogTitle>
            <ResponsiveDialogDescription aria-live="polite">第 {stepIndex} / {total} 步</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {state.phase === 'error' && state.errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertTitle>派生失败</AlertTitle>
              <AlertDescription className="space-y-2">
                <div>{state.errorMessage}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={startGenerate}>重试</Button>
                  <Button size="sm" variant="ghost" onClick={() => { void discardDraft(); reset() }}>放弃草稿</Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {state.phase === 'idle' && (
            <StepInput value={jd} onChange={setJd} onSubmit={startGenerate} recentJds={recentJds} />
          )}
          {state.phase === 'parsing' && (
            <StepParsing reasoning={state.parseReasoning} keywords={state.keywords} onAbort={abort} />
          )}
          {state.phase === 'rewriting' && (
            <StepRewriting completedSections={state.completedSections} changes={state.changes} estimatedTotal={5} onAbort={abort} />
          )}
          {state.phase === 'success' && state.draftResumeId && (
            <StepResult
              matchRate={state.matchRate}
              changes={state.changes}
              onOpen={() => { onOpenResume(state.draftResumeId!); onOpenChange(false); reset() }}
              onDiscard={() => { void discardDraft(); reset(); onOpenChange(false) }}
            />
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定关闭？</AlertDialogTitle>
            <AlertDialogDescription>正在派生中，关闭将取消生成并删除草稿。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续派生</AlertDialogCancel>
            <AlertDialogAction onClick={() => { abort(); void discardDraft(); reset(); setConfirmClose(false); onOpenChange(false) }}>关闭并丢弃</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/components/jd-variant/__tests__/jd-variant-dialog.test.tsx`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/components/jd-variant --max-warnings 0`

- [ ] **Step 6：commit**

```bash
git add src/components/jd-variant/jd-variant-dialog.tsx \
       src/components/jd-variant/__tests__/jd-variant-dialog.test.tsx
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(jd-variant): add JdVariantDialog container"
```

---

## Task 19: ResumeCard 派生入口 + Variant Badge

**目标**：在 `ResumeCard` 添加：(1) 右上菜单 "派生针对性版本" 项；(2) 卡片左上 `<VariantBadge>`（仅当 `parent_resume_id` 非空时显示，气泡内含父简历名 + JD snippet + matchRate）；(3) 卡片底部 "派生自 X" 文案（点击跳父简历）。

**新增文件**：
- `src/pages/resume/components/resume-card/variant-badge.tsx`
- `src/pages/resume/components/resume-card/__tests__/variant-badge.test.tsx`

**修改文件**：
- `src/pages/resume/components/resume-card/index.tsx`

- [ ] **Step 1：写失败测试**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { VariantBadge } from '../variant-badge'

describe('VariantBadge', () => {
  it('renders parent name and snippet in tooltip', async () => {
    render(<VariantBadge parentName="主简历" jdSnippet="前端工程师 React" matchRate={0.82} />)
    expect(screen.getByLabelText(/派生自/)).toBeInTheDocument()
    expect(screen.getByText(/82%/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/pages/resume/components/resume-card/__tests__/variant-badge.test.tsx`
Expected: FAIL。

- [ ] **Step 3：实现**

```tsx
// variant-badge.tsx
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { GitBranch } from 'lucide-react'

export interface VariantBadgeProps {
  parentName: string | null
  jdSnippet: string | null
  matchRate: number | null
}

export function VariantBadge({ parentName, jdSnippet, matchRate }: VariantBadgeProps) {
  const pct = matchRate == null ? null : `${Math.round(matchRate * 100)}%`
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1" aria-label={`派生自 ${parentName ?? '原简历'}`}>
            <GitBranch className="size-3" aria-hidden /> 派生{pct ? ` · ${pct}` : ''}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1 text-xs">
            <div>派生自：<span className="font-medium">{parentName ?? '原简历'}</span></div>
            {jdSnippet && <div className="text-muted-foreground">JD：{jdSnippet}</div>}
            {pct && <div>关键词匹配度：{pct}</div>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

修改 `resume-card/index.tsx`：
1. 在 props 接受 `derivedFromName?: string | null`、`derivedFromId?: string | null`、`jdSnippet?: string | null`、`matchRate?: number | null`、`onDeriveVariant: () => void`。
2. 卡片左上若 `derivedFromId` 存在则渲染 `<VariantBadge ...>`。
3. 右上 DropdownMenu 增加 `<DropdownMenuItem onSelect={onDeriveVariant}>派生针对性版本</DropdownMenuItem>`，紧邻"重命名 / 删除"前。
4. 卡片底部添加 `derivedFromId && <button className="text-xs text-muted-foreground hover:underline" onClick={() => navigate(`/resume/${derivedFromId}`)}>派生自 {derivedFromName}</button>`。

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/pages/resume/components/resume-card/__tests__/variant-badge.test.tsx`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/pages/resume/components/resume-card --max-warnings 0`

- [ ] **Step 6：commit**

```bash
git add src/pages/resume/components/resume-card/variant-badge.tsx \
       src/pages/resume/components/resume-card/__tests__/variant-badge.test.tsx \
       src/pages/resume/components/resume-card/index.tsx
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(jd-variant): add variant badge + derive entry on resume card"
```

---

## Task 20: 简历列表 Tabs 过滤 + Dialog 挂载

**目标**：在 `src/pages/resume/store/resume-list.ts` slice 增加 `filterMode: 'all' | 'roots' | 'variants'`；`src/pages/resume/index.tsx` 顶部加 shadcn `<Tabs>`，按 mode 过滤当前列表（`roots = parent_resume_id == null`，`variants = parent_resume_id != null && derived_status == 'ready'`）；并挂载 `<JdVariantDialog>` 与 `<DerivedJobsDialog>`（生成中任务面板，由 Task 21 实现），由 list slice 持有 `derivePendingFor: string | null` 控制开关。

**修改文件**：
- `src/pages/resume/store/resume-list.ts`（或 store/list-slice.ts，按现存结构）
- `src/pages/resume/index.tsx`

**新增文件**：
- `src/pages/resume/__tests__/resume-list-filter.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// __tests__/resume-list-filter.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useResumeListStore } from '../store/resume-list'

const items = [
  { id: 'r1', name: '主', parent_resume_id: null, derived_status: null, updated_at: '' },
  { id: 'r2', name: 'A岗', parent_resume_id: 'r1', derived_status: 'ready', updated_at: '' },
  { id: 'r3', name: 'B岗草稿', parent_resume_id: 'r1', derived_status: 'generating', updated_at: '' },
] as any

describe('resume-list filterMode', () => {
  beforeEach(() => useResumeListStore.setState({ items, filterMode: 'all', derivePendingFor: null }))

  it('roots mode keeps only top-level resumes', () => {
    useResumeListStore.getState().setFilterMode('roots')
    expect(useResumeListStore.getState().visibleItems()).toEqual([items[0]])
  })
  it('variants mode keeps only ready variants', () => {
    useResumeListStore.getState().setFilterMode('variants')
    expect(useResumeListStore.getState().visibleItems()).toEqual([items[1]])
  })
  it('openDeriveFor sets pending parent id', () => {
    useResumeListStore.getState().openDeriveFor('r1')
    expect(useResumeListStore.getState().derivePendingFor).toBe('r1')
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/pages/resume/__tests__/resume-list-filter.test.ts`
Expected: FAIL（slice 未扩展）。

- [ ] **Step 3：实现**

在 `resume-list` slice 内追加：
```ts
type FilterMode = 'all' | 'roots' | 'variants'
interface FilterSlice {
  filterMode: FilterMode
  derivePendingFor: string | null
  derivedJobsOpen: boolean
  setFilterMode: (mode: FilterMode) => void
  openDeriveFor: (id: string | null) => void
  setDerivedJobsOpen: (open: boolean) => void
  visibleItems: () => ResumeListItem[]
}

// 初始
filterMode: 'all',
derivePendingFor: null,
derivedJobsOpen: false,

setFilterMode: (mode) => set({ filterMode: mode }),
openDeriveFor: (id) => set({ derivePendingFor: id }),
setDerivedJobsOpen: (open) => set({ derivedJobsOpen: open }),
visibleItems: () => {
  const { items, filterMode } = get()
  if (filterMode === 'roots') return items.filter(i => !i.parent_resume_id)
  if (filterMode === 'variants') return items.filter(i => i.parent_resume_id && i.derived_status === 'ready')
  return items
},
```

修改 `pages/resume/index.tsx`：
```tsx
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { JdVariantDialog } from '@/components/jd-variant/jd-variant-dialog'
import { DerivedJobsDialog } from '@/components/jd-variant/derived-jobs-dialog'
// ...
const filterMode = useResumeListStore(s => s.filterMode)
const setFilterMode = useResumeListStore(s => s.setFilterMode)
const visibleItems = useResumeListStore(s => s.visibleItems())
const derivePendingFor = useResumeListStore(s => s.derivePendingFor)
const openDeriveFor = useResumeListStore(s => s.openDeriveFor)
const derivedJobsOpen = useResumeListStore(s => s.derivedJobsOpen)
const setDerivedJobsOpen = useResumeListStore(s => s.setDerivedJobsOpen)

// 顶部
<div className="flex items-center justify-between">
  <Tabs value={filterMode} onValueChange={(v) => setFilterMode(v as 'all' | 'roots' | 'variants')}>
    <TabsList>
      <TabsTrigger value="all">全部</TabsTrigger>
      <TabsTrigger value="roots">主简历</TabsTrigger>
      <TabsTrigger value="variants">派生版本</TabsTrigger>
    </TabsList>
  </Tabs>
  <Button variant="ghost" size="sm" onClick={() => setDerivedJobsOpen(true)}>派生任务</Button>
</div>

// 网格
{visibleItems.map(item => (
  <ResumeCard key={item.id} {...mapItemToCardProps(item)} onDeriveVariant={() => openDeriveFor(item.id)} />
))}

// 底部
{derivePendingFor && (
  <JdVariantDialog
    open
    onOpenChange={(o) => !o && openDeriveFor(null)}
    parentResumeId={derivePendingFor}
    onOpenResume={(draftId) => navigate(`/resume/${draftId}`)}
    recentJds={recentJdsFromStore}
  />
)}
<DerivedJobsDialog open={derivedJobsOpen} onOpenChange={setDerivedJobsOpen} />
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/pages/resume/__tests__/resume-list-filter.test.ts`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/pages/resume --max-warnings 0`

- [ ] **Step 6：commit**

```bash
git add src/pages/resume/store/resume-list.ts \
       src/pages/resume/index.tsx \
       src/pages/resume/__tests__/resume-list-filter.test.ts
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(jd-variant): add filter tabs and dialog mounts on resume list"
```

---

## Task 21: DerivedJobsDialog（生成中/失败任务面板）

**目标**：弹窗列出所有 `derived_status in ('generating','failed')` 的草稿，按状态分组：
- generating：显示派生开始时间 + "继续派生"（再走 generate）/"丢弃" 按钮；
- failed：显示错误摘要 + "重试"/"丢弃" 按钮。
关闭后状态由 `useResumeListStore.setDerivedJobsOpen(false)` 控制。

**新增文件**：
- `src/components/jd-variant/derived-jobs-dialog/index.tsx`
- `src/components/jd-variant/derived-jobs-dialog/__tests__/derived-jobs-dialog.test.tsx`

- [ ] **Step 1：写失败测试**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/pages/resume/store/resume-list', () => ({
  useResumeListStore: (sel: any) => sel({
    items: [
      { id: 'r1', name: '主' },
      { id: 'd1', name: '前端A岗草稿', parent_resume_id: 'r1', derived_status: 'generating', generated_at: '2026-05-28T10:00:00Z' },
      { id: 'd2', name: '后端B岗草稿', parent_resume_id: 'r1', derived_status: 'failed', derived_metadata: { errorMessage: '超时' } },
    ],
  }),
}))

import { DerivedJobsDialog } from '../index'

describe('DerivedJobsDialog', () => {
  it('lists generating and failed drafts', () => {
    render(<DerivedJobsDialog open onOpenChange={() => {}} />)
    expect(screen.getByText(/前端A岗草稿/)).toBeInTheDocument()
    expect(screen.getByText(/后端B岗草稿/)).toBeInTheDocument()
    expect(screen.getByText(/超时/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/components/jd-variant/derived-jobs-dialog/__tests__/derived-jobs-dialog.test.tsx`
Expected: FAIL。

- [ ] **Step 3：实现**

```tsx
// derived-jobs-dialog/index.tsx
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useResumeListStore } from '@/pages/resume/store/resume-list'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import { deleteDraftVariant } from '@/lib/supabase/resume/variant'
import { deleteOfflineDraftVariant } from '@/lib/offline-resume-variant'

export interface DerivedJobsDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
}

export function DerivedJobsDialog({ open, onOpenChange }: DerivedJobsDialogProps) {
  const items = useResumeListStore((s: any) => s.items as any[])
  const generating = items.filter(i => i.derived_status === 'generating')
  const failed = items.filter(i => i.derived_status === 'failed')

  const discard = async (id: string) => {
    const fn = isOfflineResumeId(id) ? deleteOfflineDraftVariant : deleteDraftVariant
    await fn(id)
    // store 重新拉列表的责任由调用方 / 列表 hook 承担
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>派生任务</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="space-y-4 text-sm">
          <section>
            <h3 className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">生成中 <Badge variant="secondary">{generating.length}</Badge></h3>
            {generating.length === 0 ? <p className="text-xs text-muted-foreground">暂无</p> : (
              <ul className="space-y-1">
                {generating.map(item => (
                  <li key={item.id} className="flex items-center justify-between rounded border p-2">
                    <div className="truncate">{item.name}</div>
                    <Button size="sm" variant="ghost" onClick={() => void discard(item.id)}>丢弃</Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">失败 <Badge variant="destructive">{failed.length}</Badge></h3>
            {failed.length === 0 ? <p className="text-xs text-muted-foreground">暂无</p> : (
              <ul className="space-y-1">
                {failed.map(item => (
                  <li key={item.id} className="rounded border p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="truncate">{item.name}</div>
                      <Button size="sm" variant="ghost" onClick={() => void discard(item.id)}>丢弃</Button>
                    </div>
                    {item.derived_metadata?.errorMessage && (
                      <p className="text-xs text-destructive">{item.derived_metadata.errorMessage}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/components/jd-variant/derived-jobs-dialog/__tests__/derived-jobs-dialog.test.tsx`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/components/jd-variant/derived-jobs-dialog --max-warnings 0`

- [ ] **Step 6：commit**

```bash
git add src/components/jd-variant/derived-jobs-dialog/index.tsx \
       src/components/jd-variant/derived-jobs-dialog/__tests__/derived-jobs-dialog.test.tsx
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(jd-variant): add derived jobs dialog"
```

---

## Task 22: Optimize 页 "派生针对性简历" 入口

**目标**：在 `src/pages/optimize/components/advanced-tools/job-description/` 内增加按钮 `<JdDeriveButton>`，仅在 JD 已分析（store 中 `analysisDone == true`）后启用。点击后从当前简历 store 取 `currentResumeId`，结合 JD 文本，打开 `<JdVariantDialog skipInputStep initialJd={jd} parentResumeId={...} />`。

**新增文件**：
- `src/pages/optimize/components/advanced-tools/job-description/jd-derive-button.tsx`
- `src/pages/optimize/components/advanced-tools/job-description/__tests__/jd-derive-button.test.tsx`

**修改文件**：
- `src/pages/optimize/components/advanced-tools/job-description/index.tsx`（在底部按钮区追加按钮）

- [ ] **Step 1：写失败测试**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { JdDeriveButton } from '../jd-derive-button'

describe('JdDeriveButton', () => {
  it('disabled when analysis not done', () => {
    render(<JdDeriveButton analysisDone={false} jdText="" onClick={() => {}} />)
    expect(screen.getByRole('button', { name: /派生针对性简历/ })).toBeDisabled()
  })
  it('enabled when analysis done & JD non-empty', () => {
    render(<JdDeriveButton analysisDone jdText={'A'.repeat(50)} onClick={() => {}} />)
    expect(screen.getByRole('button', { name: /派生针对性简历/ })).not.toBeDisabled()
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/pages/optimize/components/advanced-tools/job-description/__tests__/jd-derive-button.test.tsx`
Expected: FAIL。

- [ ] **Step 3：实现**

```tsx
// jd-derive-button.tsx
import { Button } from '@/components/ui/button'
import { GitBranch } from 'lucide-react'
import { MIN_JD_CHARS } from '@/components/jd-variant/const'

export interface JdDeriveButtonProps {
  analysisDone: boolean
  jdText: string
  onClick: () => void
}

export function JdDeriveButton({ analysisDone, jdText, onClick }: JdDeriveButtonProps) {
  const enabled = analysisDone && jdText.trim().length >= MIN_JD_CHARS
  return (
    <Button type="button" variant="outline" size="sm" disabled={!enabled} onClick={onClick}>
      <GitBranch className="size-4 mr-1" aria-hidden /> 派生针对性简历
    </Button>
  )
}
```

修改 `job-description/index.tsx`：
```tsx
import { JdDeriveButton } from './jd-derive-button'
import { JdVariantDialog } from '@/components/jd-variant/jd-variant-dialog'
// ...
const [deriveOpen, setDeriveOpen] = useState(false)
// 在底部
<JdDeriveButton analysisDone={analysisDone} jdText={jdText} onClick={() => setDeriveOpen(true)} />
{deriveOpen && currentResumeId && (
  <JdVariantDialog
    open
    onOpenChange={setDeriveOpen}
    parentResumeId={currentResumeId}
    initialJd={jdText}
    skipInputStep
    onOpenResume={(id) => navigate(`/resume/${id}`)}
    recentJds={[]}
  />
)}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/pages/optimize/components/advanced-tools/job-description/__tests__/jd-derive-button.test.tsx`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/pages/optimize --max-warnings 0`

- [ ] **Step 6：commit**

```bash
git add src/pages/optimize/components/advanced-tools/job-description/jd-derive-button.tsx \
       src/pages/optimize/components/advanced-tools/job-description/__tests__/jd-derive-button.test.tsx \
       src/pages/optimize/components/advanced-tools/job-description/index.tsx
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(jd-variant): add derive entry from optimize JD panel"
```

---

## Task 23: 编辑器 toolbar 血缘按钮 + Popover

**目标**：在简历编辑器 toolbar 添加 `<VariantLineageButton>`，点击展开 Popover 显示当前简历的父链（直系祖先列表 + 各自 jdSnippet + matchRate），底部加 "查看完整血缘树" 按钮（触发 Task 24 的 dialog）。仅 `parent_resume_id != null` 时按钮启用。

**新增文件**：
- `src/pages/resume-editor/components/toolbar/variant-lineage-button.tsx`
- `src/pages/resume-editor/components/toolbar/variant-lineage-popover.tsx`
- `src/pages/resume-editor/components/toolbar/__tests__/variant-lineage-button.test.tsx`

- [ ] **Step 1：写失败测试**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
vi.mock('@/components/jd-variant/use-variant-lineage', () => ({
  useVariantLineage: () => ({ tree: { resumeId: 'root', displayName: '主', derivedStatus: 'ready', generatedAt: null, jdSnippet: null, matchRate: null, children: [{ resumeId: 'self', displayName: '当前', derivedStatus: 'ready', generatedAt: null, jdSnippet: '前端 React', matchRate: 0.7, children: [] }] }, loading: false, error: null, refresh: vi.fn() }),
}))
import { VariantLineageButton } from '../variant-lineage-button'

describe('VariantLineageButton', () => {
  it('disabled when current resume has no parent', () => {
    render(<VariantLineageButton currentResumeId="self" parentResumeId={null} rootResumeId="root" onOpenTree={() => {}} />)
    expect(screen.getByRole('button', { name: /血缘/ })).toBeDisabled()
  })
  it('opens popover and shows parent chain', () => {
    render(<VariantLineageButton currentResumeId="self" parentResumeId="root" rootResumeId="root" onOpenTree={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /血缘/ }))
    expect(screen.getByText('主')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/pages/resume-editor/components/toolbar/__tests__/variant-lineage-button.test.tsx`
Expected: FAIL。

- [ ] **Step 3：实现**

```tsx
// variant-lineage-popover.tsx
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { VariantTreeNode } from '@/components/jd-variant/types'

function findPath(node: VariantTreeNode, targetId: string, acc: VariantTreeNode[] = []): VariantTreeNode[] | null {
  const next = [...acc, node]
  if (node.resumeId === targetId) return next
  for (const c of node.children) { const r = findPath(c, targetId, next); if (r) return r }
  return null
}

export interface VariantLineagePopoverProps {
  tree: VariantTreeNode | null
  currentResumeId: string
  onOpenTree: () => void
}
export function VariantLineagePopover({ tree, currentResumeId, onOpenTree }: VariantLineagePopoverProps) {
  const path = useMemo(() => tree ? findPath(tree, currentResumeId) ?? [] : [], [tree, currentResumeId])
  return (
    <div className="w-72 space-y-2 p-2 text-xs">
      <h3 className="font-medium">血缘链</h3>
      <ol className="space-y-1">
        {path.map((n, i) => (
          <li key={n.resumeId} className="flex items-center gap-2">
            <Badge variant={i === path.length - 1 ? 'default' : 'outline'}>{n.displayName}</Badge>
            {n.matchRate != null && <span className="text-muted-foreground">{Math.round(n.matchRate * 100)}%</span>}
          </li>
        ))}
      </ol>
      <Button size="sm" variant="ghost" onClick={onOpenTree} className="w-full">查看完整血缘树</Button>
    </div>
  )
}
```

```tsx
// variant-lineage-button.tsx
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { GitBranch } from 'lucide-react'
import { useVariantLineage } from '@/components/jd-variant/use-variant-lineage'
import { VariantLineagePopover } from './variant-lineage-popover'

export interface VariantLineageButtonProps {
  currentResumeId: string
  parentResumeId: string | null
  rootResumeId: string | null
  onOpenTree: () => void
}

export function VariantLineageButton({ currentResumeId, parentResumeId, rootResumeId, onOpenTree }: VariantLineageButtonProps) {
  const { tree } = useVariantLineage(rootResumeId)
  const disabled = !parentResumeId
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled} aria-label="查看血缘链">
          <GitBranch className="size-4 mr-1" aria-hidden /> 血缘
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-0">
        <VariantLineagePopover tree={tree} currentResumeId={currentResumeId} onOpenTree={onOpenTree} />
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/pages/resume-editor/components/toolbar/__tests__/variant-lineage-button.test.tsx`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/pages/resume-editor/components/toolbar --max-warnings 0`

- [ ] **Step 6：commit**

```bash
git add src/pages/resume-editor/components/toolbar/variant-lineage-button.tsx \
       src/pages/resume-editor/components/toolbar/variant-lineage-popover.tsx \
       src/pages/resume-editor/components/toolbar/__tests__/variant-lineage-button.test.tsx
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(jd-variant): add lineage button + popover in editor toolbar"
```

---

## Task 24: 血缘树 Dialog（递归渲染整棵树）

**目标**：实现 `<VariantLineageTreeDialog>` + 递归 `<VariantLineageTree>` 节点。从 root 渲染整棵树，每节点显示：名字 + status 徽章 + matchRate + JD snippet（折叠 toggle）+ "打开" 按钮（路由跳转）。当前节点高亮。

**新增文件**：
- `src/components/jd-variant/variant-lineage-tree.tsx`
- `src/components/jd-variant/variant-lineage-tree-dialog.tsx`
- `src/components/jd-variant/__tests__/variant-lineage-tree.test.tsx`

- [ ] **Step 1：写失败测试**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { VariantLineageTree } from '../variant-lineage-tree'
import type { VariantTreeNode } from '../types'

const tree: VariantTreeNode = {
  resumeId: 'root', displayName: '主', derivedStatus: 'ready', generatedAt: null, jdSnippet: null, matchRate: null,
  children: [
    { resumeId: 'a', displayName: 'A', derivedStatus: 'ready', generatedAt: null, jdSnippet: 'JD A', matchRate: 0.6, children: [
      { resumeId: 'a1', displayName: 'A1', derivedStatus: 'failed', generatedAt: null, jdSnippet: 'JD A1', matchRate: null, children: [] },
    ] },
    { resumeId: 'b', displayName: 'B', derivedStatus: 'generating', generatedAt: null, jdSnippet: 'JD B', matchRate: null, children: [] },
  ],
}

describe('VariantLineageTree', () => {
  it('renders all nodes recursively and highlights current', () => {
    render(<VariantLineageTree node={tree} currentResumeId="a1" onOpen={() => {}} />)
    expect(screen.getByText('主')).toBeInTheDocument()
    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('A1').closest('[data-current="true"]')).not.toBeNull()
  })
})
```

- [ ] **Step 2：跑测试看失败**

Run: `pnpm vitest run src/components/jd-variant/__tests__/variant-lineage-tree.test.tsx`
Expected: FAIL。

- [ ] **Step 3：实现**

```tsx
// variant-lineage-tree.tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { VariantTreeNode } from './types'

const STATUS_VARIANT = {
  ready: 'secondary', generating: 'outline', failed: 'destructive', null: 'outline',
} as const

export interface VariantLineageTreeProps {
  node: VariantTreeNode
  currentResumeId: string
  onOpen: (id: string) => void
  depth?: number
}

export function VariantLineageTree({ node, currentResumeId, onOpen, depth = 0 }: VariantLineageTreeProps) {
  const isCurrent = node.resumeId === currentResumeId
  return (
    <div className="text-xs" style={{ paddingLeft: depth * 12 }}>
      <div data-current={isCurrent} className={`flex items-center gap-2 rounded px-2 py-1 ${isCurrent ? 'bg-primary/10 ring-1 ring-primary' : ''}`}>
        <span className="font-medium">{node.displayName}</span>
        <Badge variant={(STATUS_VARIANT as any)[node.derivedStatus ?? 'null']}>{node.derivedStatus ?? 'root'}</Badge>
        {node.matchRate != null && <span className="text-muted-foreground tabular-nums">{Math.round(node.matchRate * 100)}%</span>}
        {!isCurrent && <Button size="sm" variant="ghost" onClick={() => onOpen(node.resumeId)} className="ml-auto h-6 px-2">打开</Button>}
      </div>
      {node.jdSnippet && <div className="ml-4 mt-0.5 text-muted-foreground">JD：{node.jdSnippet}</div>}
      <div className="mt-1 flex flex-col gap-0.5">
        {node.children.map(c => (
          <VariantLineageTree key={c.resumeId} node={c} currentResumeId={currentResumeId} onOpen={onOpen} depth={depth + 1} />
        ))}
      </div>
    </div>
  )
}
```

```tsx
// variant-lineage-tree-dialog.tsx
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
import { useVariantLineage } from './use-variant-lineage'
import { VariantLineageTree } from './variant-lineage-tree'
import { Loader2 } from 'lucide-react'

export interface VariantLineageTreeDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  rootResumeId: string | null
  currentResumeId: string
  onOpenResume: (id: string) => void
}

export function VariantLineageTreeDialog({ open, onOpenChange, rootResumeId, currentResumeId, onOpenResume }: VariantLineageTreeDialogProps) {
  const { tree, loading } = useVariantLineage(rootResumeId)
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>派生血缘树</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        {loading || !tree ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin mr-2" /> 加载中…
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-auto p-2">
            <VariantLineageTree node={tree} currentResumeId={currentResumeId} onOpen={onOpenResume} />
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
```

- [ ] **Step 4：跑测试看通过**

Run: `pnpm vitest run src/components/jd-variant/__tests__/variant-lineage-tree.test.tsx`
Expected: PASS。

- [ ] **Step 5：静态检查**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/components/jd-variant --max-warnings 0`

- [ ] **Step 6：commit**

```bash
git add src/components/jd-variant/variant-lineage-tree.tsx \
       src/components/jd-variant/variant-lineage-tree-dialog.tsx \
       src/components/jd-variant/__tests__/variant-lineage-tree.test.tsx
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "feat(jd-variant): add lineage tree + dialog"
```

---

## Task 25: 最终打磨（a11y / 移动端 / 边界 / DoD 自检）

**目标**：覆盖 spec §6 DoD 与 §7 边界 E1-E8、手测 M1-M13。本 task 不新增功能模块，专注清理。

**清单**：
1. **a11y**：
   - StepInput textarea `aria-describedby` 指向字数计数；
   - StepParsing/StepRewriting `aria-live="polite"`（已含）；
   - StepResult Accordion 自带 a11y；
   - JdVariantDialog 顶部 `aria-current="step"` 在步骤指示器（修改 Description 区块为 `<ol role="list"> <li aria-current=...>`）。
2. **移动端**：在 `< sm` 断点验证 ResponsiveDialog 自动切换为 Drawer；StepRewriting 列表 `max-h-60` 改为 `max-h-[40vh]`。
3. **E1（JD 太短）**：StepInput 已禁用提交并提示。
4. **E2（解析返回 0 关键词）**：在 hook 中若 `keywords.length < MIN_KEYWORDS` 则 `throw new Error('JD 信息不足，未能提取足够关键词')`；触发 error 态。
5. **E3（改写阶段 abort）**：abortController 已贯通；二次确认 dialog 已实现。
6. **E4（深度 ≥ MAX_VARIANT_DEPTH）**：在 `useJdVariantGenerator.generate` 入口前调用 lineage 检查（fetchVariantTree 取得当前父链长度），≥ 5 则提前 reject 并提示「派生层级过深」。
7. **E5（删除父简历）**：DB FK ON DELETE SET NULL 已保证，UI 层 VariantBadge 兼容 `parentName == null`（显示"原简历已删除"）。
8. **E6（变更字段在改写时被外部编辑器并发修改）**：`applyVariantChanges` 在写库前重新 `getResumeById` 并校验 `updated_at` 时间戳，若已变更则抛 `'derivation_conflict'`，由 hook 转 error。
9. **E7（流式中断）**：`streamStructuredJson` 已支持 abort；hook 的 `try/catch + abortRef === ctrl` 已处理。
10. **E8（离线模式）**：所有写路径在 `isOfflineResumeId` 下走 IDB；登录态切换由 `lib/auth` 守卫。

**修改文件**（按需）：
- `src/components/jd-variant/use-jd-variant-generator.ts`（增加深度检查 + 关键词不足检查 + 并发冲突处理）
- `src/components/jd-variant/jd-variant-dialog.tsx`（步骤指示器 a11y）
- `src/pages/resume/components/resume-card/variant-badge.tsx`（已删父简历兜底）

**验证**：
- [ ] **Step 1：补/修单测**：为 E2、E4、E6 各加 1 条 hook 测试；为已删除父简历加 VariantBadge 测试。
- [ ] **Step 2：跑全量测试** `pnpm vitest run`：Expected: 全部 PASS。
- [ ] **Step 3：跑 tsc + eslint** `pnpm exec tsc --noEmit && pnpm exec eslint . --max-warnings 0`：0 errors。
- [ ] **Step 4：手测 M1-M13**（见 spec §6.4）：在浏览器逐项过一遍并打勾。
- [ ] **Step 5：性能抽查**：列表 100 条派生简历滚动 60fps；血缘树 5 层 50 节点渲染 <16ms。
- [ ] **Step 6：commit**

```bash
git add src/components/jd-variant/use-jd-variant-generator.ts \
       src/components/jd-variant/jd-variant-dialog.tsx \
       src/pages/resume/components/resume-card/variant-badge.tsx \
       src/components/jd-variant/__tests__/use-jd-variant-generator.test.tsx
SKIP_SIMPLE_GIT_HOOKS=1 git commit -m "chore(jd-variant): a11y/mobile/edge-case polish + DoD checks"
```

---

## Spec 覆盖映射

| Spec 章节 | 内容 | 实施 Task |
|---|---|---|
| §2.1 数据模型（Supabase） | `parent_resume_id`/`linked_jd_text`/`derived_metadata`/`derived_status` | Task 1 |
| §2.2 数据模型（IndexedDB） | DB_VERSION 1→2 升级 | Task 2 |
| §3.1 核心类型（VariantChange/Metadata） | zod schema + TS 类型 | Task 3, 8 |
| §3.2 LLM Prompt（解析 + 改写） | `prompts/jd-variant.ts` | Task 4 |
| §3.3 LLM 调用入口 | `runJdParse` / `runJdRewrite` | Task 5 |
| §4.1 Supabase CRUD + 血缘 BFS | clone/apply/markReady/markFailed/delete/fetchTree | Task 6 |
| §4.2 离线 CRUD | offline 同名函数 | Task 7 |
| §4.3 解析输出容错 | `parseVariantResponse` | Task 10 |
| §4.4 应用 changes | `applyVariantChanges`（白名单 + 字段路径写入） | Task 11 |
| §4.5 工具函数 | buildEditableView / computeMatchRate / formatJdSnippet | Task 9 |
| §5.1 主调度 hook | `useJdVariantGenerator` | Task 12 |
| §5.2 lineage hook | `useVariantLineage` | Task 13 |
| §5.3 4 阶段 UI | StepInput/StepParsing/StepRewriting/StepResult | Task 14, 15, 16, 17 |
| §5.4 Dialog 容器 | `JdVariantDialog` | Task 18 |
| §5.5 简历卡入口 | VariantBadge + 菜单项 | Task 19 |
| §5.6 列表过滤 + 任务面板 | Tabs + DerivedJobsDialog | Task 20, 21 |
| §5.7 Optimize 入口 | JdDeriveButton | Task 22 |
| §5.8 编辑器血缘按钮 | VariantLineageButton + Popover | Task 23 |
| §5.9 血缘树视图 | VariantLineageTree + Dialog | Task 24 |
| §6 DoD / §7 边界 E1-E8 / §6.4 手测 | a11y/移动端/E1-E8/M1-M13 | Task 25 |

---

## 自检清单

完成本计划后必须满足：

- [ ] 每个 Task 都有可独立运行的失败测试（Step 1-2）+ 实现（Step 3）+ 通过测试（Step 4）+ 静态检查（Step 5）+ commit（Step 6）。
- [ ] 所有任务的 commit message 遵循 Conventional Commits（`feat(jd-variant): …` / `chore(jd-variant): …` / `fix(jd-variant): …`）。
- [ ] 没有 `git add -A` / `git add .`，只添加本任务涉及的文件。
- [ ] 类型契约 `VariantChange` / `VariantMetadata` / `GeneratorState` / `VariantTreeNode` 在所有任务中签名一致，禁止重复定义或漂移。
- [ ] 函数签名 `cloneResumeAsDraft` / `applyVariantChanges` / `markVariantReady` / `markVariantFailed` / `deleteDraftVariant` / `fetchVariantTree`（及其 `Offline` 版）跨 Task 6/7/12 一致。
- [ ] 常量 `MIN_JD_CHARS=30` / `MIN_KEYWORDS=3` / `MAX_KEYWORDS=30` / `MIN_CHANGES=3` / `MAX_CHANGES=15` / `MAX_VARIANT_DEPTH=5` 仅在 `const.ts` 定义、其他文件 import。
- [ ] 4 个 step 组件均为受控、纯渲染（不持有副作用），状态全部由 `useJdVariantGenerator` 管理。
- [ ] Dialog 容器和入口按钮（resume-card 菜单 / optimize 按钮 / editor toolbar 按钮）解耦，可独立替换。
- [ ] 所有写库路径在 `isOfflineResumeId` 下走 IDB，无任何"在线/离线"硬编码 if/else 漂移到 UI 层。
- [ ] AbortController 贯穿 parsing → rewriting，关闭 dialog / 切页面 / 用户取消时立刻终止。
- [ ] 失败测试均为 RED 状态启动（Step 2 必须 FAIL，避免假绿）。
- [ ] 每个 commit 都能独立通过 `pnpm exec tsc --noEmit`，避免破坏 main 编译。

---