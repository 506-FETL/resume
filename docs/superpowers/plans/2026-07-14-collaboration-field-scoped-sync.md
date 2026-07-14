# 协作编辑字段级同步与光标保持（子项目 A）实施计划

> **给代理执行者：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐步实现本计划。步骤使用复选框（`- [ ]`）语法跟踪，执行时必须把本文件同步更新为最新状态：完成的步骤改为 `- [x]`，验证步骤追加一行 `执行记录：...` 写明真实命令结果或环境限制，受阻/跳过的步骤保持未勾选并注明原因。

**目标：** 让协作编辑做到「改不同字段互不覆盖、改同一自由文本字段按字符合并、聚焦控件光标不丢」，替换当前「整段 section 回写 Automerge」的写路径。

**架构：** 复用现有读路径 diff 规划器 `planRemoteFormSync` 计算最小变更；新增纯函数 applier 把变更翻译为 Automerge 根级 `updateText`（自由文本白名单）/ `setLeaf`（富文本与原子）/ 数组子代理 `push`·`deleteAt`；新增 `classifyLeaf` 字段分类与 `mapCaretByDiff` 光标映射；把 5 处内联 `watch` 写路径收敛到共享 hook `useResumeFormSync`。

**技术栈：** React Hook Form 7.66、Automerge v3（`next` API：`updateText`/`splice`/`getCursor`）、Zustand、Node 22 内置测试运行器（`node --test --experimental-strip-types`）。

**规格：** `docs/superpowers/specs/2026-07-14-collaboration-field-scoped-sync-design.md`

---

## 文件结构

**新建：**
- `src/hooks/collab/classify-leaf.ts` —— 字段分类表 + `classifyLeaf(sectionKey, relativePath)`。纯函数，无 app 依赖。
- `src/hooks/collab/classify-leaf.test.ts` —— 分类回归测试。
- `src/hooks/collab/text-caret-diff.ts` —— `mapCaretByDiff(oldStr, newStr, caret)`。纯函数。
- `src/hooks/collab/text-caret-diff.test.ts` —— 光标映射回归测试。
- `src/hooks/collab/write-plan.ts` —— **纯函数** `buildWriteOps(plan, sectionKey, classify)`：把 `RemoteFormSyncPlan` 翻译成一组「文档写操作描述」（`WriteOp[]`，纯数据，**不 import 任何 `@/` 别名或 app 运行时**，仅依赖 `lodash/toPath` 与同目录 `classify-leaf`）。便于 `node --test`。
- `src/hooks/collab/write-plan.test.ts` —— `buildWriteOps` 回归测试（纯函数，node 可跑）。
- `src/hooks/collab/apply-write-ops.ts` —— **执行器**（含 app 运行时依赖）：`applyWriteOps(doc, ops, deps)`，`deps = { updateText, setLeaf }` **依赖注入**，默认绑定 `@automerge/automerge` 的 `next.updateText` 与项目 `setLeaf`。因 import `@/` 与 Automerge，**不写 node 纯函数单测**，由 Task 8 浏览器/集成路径验证；可选：对「路由分发逻辑」用注入的 fake deps 写一个不 import `@/` 的轻测（见 Task 4）。
- `src/hooks/collab/use-resume-form-sync.ts` —— 共享 hook，整合读（现有 `useFormRemoteSync`）+ 写（diff→store 动作）+ 光标保持。
- `src/hooks/collab/focus-registry.ts` —— 轻量「当前聚焦自由文本字段」注册（`document.activeElement` + `name` 反查或 focus/blur 记录）。

**关键约束（测试可加载性）：** `node --test --experimental-strip-types` **不解析 `@/` 别名**。因此 `classify-leaf` / `text-caret-diff` / `write-plan` 三个纯模块及其测试**只能 import 相对路径（带 `.ts` 后缀）与 npm 包（如 `lodash`）**，绝不能 import `optimize/utils.ts` 的 `setLeaf`（它会传递引入 `@/lib/automerge` 等整套运行时）。`setLeaf` 只在执行器 `apply-write-ops.ts` 中使用，且该文件不参与纯函数 node 测试。

**修改：**
- `src/hooks/form-remote-sync.ts` —— 无需改 `planRemoteFormSync`；若需要导出 `normalizeToProp` 路径工具则在此补充（复用 `lodash/toPath` + 数字段规范化，参考 `setLeaf`）。`buildWriteOps` 直接从此 import `planRemoteFormSync` 的**类型**（`RemoteFormSyncPlan`）。
- `src/store/resume/form.ts` —— 新增 store 动作 `updateFormFields(sectionKey, nextValue, applyDoc)`：乐观整段替换本地 state + 经 `applyResumeChange` 用 `applyDoc(doc)` 写文档。
- `src/pages/resume/editor/components/forms/hooks/use-resume-field-form.ts` —— 写路径改用 `useResumeFormSync`。
- `src/pages/resume/editor/components/forms/basic-resume/index.tsx`
- `src/pages/resume/editor/components/forms/job-intent/index.tsx`
- `src/pages/resume/editor/components/forms/self-evaluation/index.tsx`
- `src/pages/resume/editor/components/forms/application-info/index.tsx`

**测试运行：** `node --test --experimental-strip-types <file.test.ts>`（纯函数测试文件用 `.ts` 相对导入，import 路径带 `.ts` 后缀，不使用 `@/` 别名，保证脱离构建工具可运行）。

---

## 任务 1：字段分类 `classifyLeaf`

**文件：**
- 新建：`src/hooks/collab/classify-leaf.ts`
- 测试：`src/hooks/collab/classify-leaf.test.ts`

- [ ] **步骤 1：先写失败测试**

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyLeaf } from './classify-leaf.ts'

test('rich text leaves', () => {
  assert.equal(classifyLeaf('self_evaluation', 'content'), 'rich')
  assert.equal(classifyLeaf('work_experience', 'items.0.workInfo'), 'rich')
  assert.equal(classifyLeaf('skill_specialty', 'description'), 'rich')
})

test('free text leaves', () => {
  assert.equal(classifyLeaf('basics', 'name'), 'freeText')
  assert.equal(classifyLeaf('basics', 'email'), 'freeText')
  assert.equal(classifyLeaf('job_intent', 'jobIntent'), 'freeText')
  assert.equal(classifyLeaf('work_experience', 'items.2.companyName'), 'freeText')
  assert.equal(classifyLeaf('basics', 'customFields.0.value'), 'freeText')
})

test('atomic leaves: enums, dates, numbers, unregistered', () => {
  assert.equal(classifyLeaf('edu_background', 'items.0.degree'), 'atomic') // Select enum
  assert.equal(classifyLeaf('job_intent', 'dateEntry'), 'atomic')
  assert.equal(classifyLeaf('skill_specialty', 'skills.0.proficiencyLevel'), 'atomic')
  assert.equal(classifyLeaf('work_experience', 'items.0.workDuration.1'), 'atomic')
  assert.equal(classifyLeaf('basics', 'birthMonth'), 'atomic')
  assert.equal(classifyLeaf('basics', 'gender'), 'atomic')
  assert.equal(classifyLeaf('basics', 'heightCm'), 'atomic')
  assert.equal(classifyLeaf('skill_specialty', 'skills.0.label'), 'atomic') // 展示型，不 char-merge
})
```

- [ ] **步骤 2：运行并确认失败**

运行：`node --test --experimental-strip-types src/hooks/collab/classify-leaf.test.ts`
预期：FAIL（`classify-leaf.ts` 不存在 / `classifyLeaf` 未定义）

- [ ] **步骤 3：写最小实现**

要点：
- `RICH_TEXT`：`Record<sectionKey, Set<leafFieldName>>`，来自 spec §3.3 富文本清单（`content`/`description`/`workInfo`/`internshipInfo`/`projectInfo`/`eduInfo`/`campusInfo`）。
- `FREE_TEXT`：`Record<sectionKey, Set<leafFieldName>>`，来自 spec §3.3 自由文本白名单（字段名已按 `src/lib/schema/resume/form/*.ts` 核对）：
  - `basics`: `name`, `phone`, `email`, `nation`, `nativePlace`, `customFields.*.label`, `customFields.*.value`
  - `job_intent`: `jobIntent`, `intentionalCity`
  - `application_info`: `applicationSchool`, `applicationMajor`
  - `work_experience` items: `companyName`, `position`
  - `internship_experience` items: `companyName`, `position`
  - `project_experience` items: `projectName`, `participantRole`
  - `campus_experience` items: `experienceName`, `role`
  - `edu_background` items: `schoolName`, `professional`（**不含** `degree`，其为 Select 枚举 → atomic）
  - `honors_certificates` certificates: `name`
  - `hobbies` hobbies: `name`
- 归一化：把 `relativePath` 用 `.` 拆段，数字段（数组索引）替换为 `*`，取**末段字段名**（以及带 `*` 的父段用于数组项匹配）匹配集合。
- 判定顺序：命中 rich → `'rich'`；命中 freeText → `'freeText'`；否则 `'atomic'`。
- 导出 `type LeafClass = 'rich' | 'freeText' | 'atomic'`。

> 注意：自由文本白名单**只允许真正的 `<Input>` 自由文本**。任何 Select 枚举、日期字符串、number、展示型 `<span>` 字段一律不列入（默认落入 atomic）。执行前用对应 `src/lib/schema/resume/form/*.ts` 核对每个字段确为 `z.string()` 自由输入，避免误纳。

- [ ] **步骤 4：运行并确认通过**

运行：`node --test --experimental-strip-types src/hooks/collab/classify-leaf.test.ts`
预期：PASS

- [ ] **步骤 5：提交**

```bash
git add src/hooks/collab/classify-leaf.ts src/hooks/collab/classify-leaf.test.ts
git commit -m "feat(collab): add leaf field classifier for field-scoped sync"
```

---

## 任务 2：光标映射 `mapCaretByDiff`

**文件：**
- 新建：`src/hooks/collab/text-caret-diff.ts`
- 测试：`src/hooks/collab/text-caret-diff.test.ts`

- [ ] **步骤 1：先写失败测试**

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mapCaretByDiff } from './text-caret-diff.ts'

test('no change keeps caret', () => {
  assert.equal(mapCaretByDiff('hello', 'hello', 3), 3)
})
test('remote insert before caret shifts caret right', () => {
  // 'helXlo' inserted 'X' at index 3, local caret was at 5 ('hello|')
  assert.equal(mapCaretByDiff('hello', 'helXlo', 5), 6)
})
test('remote insert after caret keeps caret', () => {
  assert.equal(mapCaretByDiff('hello', 'helloX', 2), 2)
})
test('remote delete before caret shifts caret left', () => {
  assert.equal(mapCaretByDiff('hello', 'helo', 5), 4)
})
test('pure prepend shifts caret', () => {
  assert.equal(mapCaretByDiff('bar', 'foobar', 1), 4)
})
test('caret inside a replaced region clamps to end of common prefix', () => {
  // old 'abcXYZdef' -> new 'abcQdef', caret at 5 (inside XYZ)
  const r = mapCaretByDiff('abcXYZdef', 'abcQdef', 5)
  assert.ok(r >= 3 && r <= 4)
})
```

- [ ] **步骤 2：运行并确认失败**

运行：`node --test --experimental-strip-types src/hooks/collab/text-caret-diff.test.ts`
预期：FAIL

- [ ] **步骤 3：写最小实现**

算法（公共前后缀）：
1. 计算最长公共前缀长度 `pre`（在 `oldStr`/`newStr` 上逐字符比较）。
2. 计算最长公共后缀长度 `suf`（不与前缀重叠，受两串剩余长度约束）。
3. `delta = newStr.length - oldStr.length`。
4. 若 `caret <= pre`：返回 `caret`（在公共前缀内，不动）。
5. 若 `caret >= oldStr.length - suf`：返回 `caret + delta`（在公共后缀内，整体平移）。
6. 否则（落在被替换区间内）：返回 `min(caret, pre + Math.max(0, newStr.length - pre - suf))` 并 `clamp` 到 `[pre, newStr.length - suf]`，即钳到新串被替换区间边界。
7. 全程对结果 `clamp` 到 `[0, newStr.length]`。

- [ ] **步骤 4：运行并确认通过**

运行：`node --test --experimental-strip-types src/hooks/collab/text-caret-diff.test.ts`
预期：PASS

- [ ] **步骤 5：提交**

```bash
git add src/hooks/collab/text-caret-diff.ts src/hooks/collab/text-caret-diff.test.ts
git commit -m "feat(collab): add caret-by-diff mapping for concurrent text edits"
```

---

## 任务 3：写操作生成 `buildWriteOps`

**文件：**
- 新建：`src/hooks/collab/write-plan.ts`
- 测试：`src/hooks/collab/write-plan.test.ts`
- 参考：`src/hooks/form-remote-sync.ts`（`planRemoteFormSync` 输出结构）

设计：`buildWriteOps(plan, sectionKey, classify)` 返回 `WriteOp[]`，其中
```ts
type WriteOp =
  | { kind: 'updateText', path: (string | number)[], value: string }
  | { kind: 'setLeaf',    path: (string | number)[], value: unknown }
  | { kind: 'arrayPush',  path: (string | number)[], value: unknown }
  | { kind: 'arrayDeleteAt', path: (string | number)[], index: number }
```
- `path` 为**含 sectionKey 的完整 Prop 路径**，数组索引段为 number（用 `lodash/toPath` 拆解 `fieldUpdate.path` 后，对纯数字段 `Number(seg)`，并在最前拼 `sectionKey`）。
- 对每个 `fieldUpdate`：`cls = classify(sectionKey, fieldUpdate.path)`；`cls==='freeText' && typeof value==='string'` → `updateText`；否则 → `setLeaf`。
- 对每个 `fieldArrayOperation`：`append` → `arrayPush`（path 为 `[sectionKey, ...arrayPathSegs]`）；`remove` → `arrayDeleteAt`。

> 注意：`updateText` 的**新旧类型判断**在执行器（任务 4 集成时）做「目标当前为字符串」兜底；此处只按 classify + 新值类型决定意图。纯函数只产出意图，方便测试。

- [ ] **步骤 1：先写失败测试**

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planRemoteFormSync } from '../form-remote-sync.ts'
import { buildWriteOps } from './write-plan.ts'
import { classifyLeaf } from './classify-leaf.ts'

test('free text leaf -> updateText with full path', () => {
  const plan = planRemoteFormSync({ name: 'ab' }, { name: 'abc' })
  const ops = buildWriteOps(plan, 'basics', classifyLeaf)
  assert.deepEqual(ops, [{ kind: 'updateText', path: ['basics', 'name'], value: 'abc' }])
})

test('enum leaf -> setLeaf (not updateText)', () => {
  const plan = planRemoteFormSync({ dateEntry: '不填' }, { dateEntry: '随时到岗' })
  const ops = buildWriteOps(plan, 'job_intent', classifyLeaf)
  assert.deepEqual(ops, [{ kind: 'setLeaf', path: ['job_intent', 'dateEntry'], value: '随时到岗' }])
})

test('rich text leaf -> setLeaf', () => {
  const plan = planRemoteFormSync({ content: '<p>a</p>' }, { content: '<p>ab</p>' })
  const ops = buildWriteOps(plan, 'self_evaluation', classifyLeaf)
  assert.deepEqual(ops, [{ kind: 'setLeaf', path: ['self_evaluation', 'content'], value: '<p>ab</p>' }])
})

test('array grow -> arrayPush; array item leaf edit -> updateText with numeric index', () => {
  const base = { items: [{ companyName: 'A' }] }
  const next = { items: [{ companyName: 'A' }, { companyName: 'B' }] }
  const ops = buildWriteOps(planRemoteFormSync(base, next, ['items']), 'work_experience', classifyLeaf)
  assert.deepEqual(ops, [{ kind: 'arrayPush', path: ['work_experience', 'items'], value: { companyName: 'B' } }])

  const edit = buildWriteOps(
    planRemoteFormSync({ items: [{ companyName: 'A' }] }, { items: [{ companyName: 'AB' }] }, ['items']),
    'work_experience', classifyLeaf,
  )
  assert.deepEqual(edit, [{ kind: 'updateText', path: ['work_experience', 'items', 0, 'companyName'], value: 'AB' }])
})

test('array shrink at tail -> arrayDeleteAt', () => {
  const ops = buildWriteOps(
    planRemoteFormSync({ items: [{ companyName: 'A' }, { companyName: 'B' }] }, { items: [{ companyName: 'A' }] }, ['items']),
    'work_experience', classifyLeaf,
  )
  assert.deepEqual(ops, [{ kind: 'arrayDeleteAt', path: ['work_experience', 'items'], index: 1 }])
})

test('no change -> no ops', () => {
  assert.deepEqual(buildWriteOps(planRemoteFormSync({ name: 'a' }, { name: 'a' }), 'basics', classifyLeaf), [])
})
```

- [ ] **步骤 2：运行并确认失败**

运行：`node --test --experimental-strip-types src/hooks/collab/write-plan.test.ts`
预期：FAIL

- [ ] **步骤 3：写最小实现**（`buildWriteOps`；`applyWriteOps` 执行器留任务 4，但可先写好签名）

- [ ] **步骤 4：运行并确认通过**

运行：`node --test --experimental-strip-types src/hooks/collab/write-plan.test.ts`
预期：PASS

- [ ] **步骤 5：提交**

```bash
git add src/hooks/collab/write-plan.ts src/hooks/collab/write-plan.test.ts
git commit -m "feat(collab): build field-scoped Automerge write ops from diff plan"
```

---

## 任务 4：文档写执行器 `applyWriteOps` + store 动作 `updateFormFields`

**文件：**
- 新建：`src/hooks/collab/apply-write-ops.ts`（执行器，含 app 运行时依赖）
- 新建：`src/hooks/collab/apply-write-ops.routing.test.ts`（**仅测路由分发**，用注入的 fake deps，**不 import `@/`**）
- 修改：`src/store/resume/form.ts`（新增 `updateFormFields`）
- 修改：`src/store/resume/const.ts`（`FormSlice` 接口加 `updateFormFields` 签名）
- 参考：`src/pages/optimize/utils.ts`（`setLeaf`）、`src/lib/automerge/document/manager.ts`（`change`）、`src/lib/automerge/document/persistence.ts`（Automerge import 风格）

**执行器设计（依赖注入，避免测试触达 `@/`）：**
```ts
// apply-write-ops.ts
import { next as Automerge } from '@automerge/automerge'
import { setLeaf } from '@/pages/optimize/utils'
import type { WriteOp } from './write-plan'

export interface WriteDeps {
  updateText: (doc: any, path: (string | number)[], value: string) => void
  setLeaf: (doc: any, path: (string | number)[], value: unknown) => void
}
const defaultDeps: WriteDeps = {
  updateText: (doc, path, value) => Automerge.updateText(doc, path, value),
  setLeaf,
}
export function getIn(doc: any, path: (string | number)[]): unknown { /* 逐段解引用 */ }
export function applyWriteOps(doc: any, ops: WriteOp[], deps: WriteDeps = defaultDeps) {
  for (const op of ops) {
    switch (op.kind) {
      case 'updateText': {
        const cur = getIn(doc, op.path)
        if (typeof cur === 'string') deps.updateText(doc, op.path, op.value)
        else deps.setLeaf(doc, op.path, op.value) // spec §5 兜底
        break
      }
      case 'setLeaf': deps.setLeaf(doc, op.path, op.value); break
      case 'arrayPush': (getIn(doc, op.path) as any[]).push(op.value); break
      case 'arrayDeleteAt': (getIn(doc, op.path) as any).deleteAt(op.index); break
    }
  }
}
```
> `getIn` 与路由分发（`switch`）是可脱 `@/` 测试的核心：路由测试**只 import `getIn`/`applyWriteOps`**，并注入 fake `deps`（记录调用）+ 普通对象/数组（`push` 原生、`deleteAt` 用 fake 实现）。因执行器文件顶部 import 了 `@/pages/optimize/utils`，纯 node 无法加载它 —— 故路由测试文件**改为直接内联一份 `applyWriteOps` 的最小副本或从一个不含 `@/` 的子模块导入**。为彻底解耦：把 `getIn` + `applyWriteOps`（纯分发，deps 全注入、无顶层 `@/` import）放在 `apply-write-ops.core.ts`，而 `apply-write-ops.ts` 只负责组装 `defaultDeps` 并 re-export。routing 测试 import `apply-write-ops.core.ts`。

**修正后的文件清单：**
- 新建：`src/hooks/collab/apply-write-ops.core.ts` —— `getIn` + `applyWriteOps(doc, ops, deps)`，**deps 必传**，无顶层 `@/`/Automerge import。可 node 测试。
- 新建：`src/hooks/collab/apply-write-ops.ts` —— import `@/pages/optimize/utils` 的 `setLeaf` 与 `next.updateText`，组装 `defaultDeps`，导出 `applyDefault(doc, ops) = applyWriteOps(doc, ops, defaultDeps)`。不参与 node 测试。
- 新建：`src/hooks/collab/apply-write-ops.core.test.ts` —— 路由分发回归测试（import core，注入 fake deps）。

`updateFormFields(sectionKey, nextValue, ops)`（新 store 动作，位于 `form.ts`）：
```ts
updateFormFields: (key, nextValue, ops) => {
  applyResumeChange(
    set,
    get,
    { [key]: nextValue },           // 乐观：整段替换本地 JS state（无 CRDT 身份问题）
    (doc) => { applyDefault(doc, ops) },
  )
}
```
> `applyResumeChange` 已有 try/catch + `pendingChanges`/`syncError` + 在线/离线调度，无需重复。

- [ ] **步骤 1：先写失败测试** `src/hooks/collab/apply-write-ops.core.test.ts`

用注入的 fake deps + 普通对象/数组断言：
- `updateText` op：目标为字符串 → 调用 `deps.updateText`（记录 path/value）；目标非字符串 → 调用 `deps.setLeaf`（回退）。
- `setLeaf` op → 调用 `deps.setLeaf`。
- `arrayPush` op → 目标父数组被 push；`arrayDeleteAt` op → 调用数组的 `deleteAt(index)`。
- `getIn` 对含 sectionKey + 数字索引的完整 path 正确解引用（如 `['work_experience','items',0,'companyName']`）。

- [ ] **步骤 2：运行并确认失败**

运行：`node --test --experimental-strip-types src/hooks/collab/apply-write-ops.core.test.ts`
预期：FAIL（`apply-write-ops.core.ts` 不存在）

- [ ] **步骤 3：写最小实现**（`apply-write-ops.core.ts` 的 `getIn` + `applyWriteOps`；再写 `apply-write-ops.ts` 组装 `defaultDeps`；再在 `form.ts`/`const.ts` 接线 `updateFormFields`）

- [ ] **步骤 4：运行并确认通过**

运行：`node --test --experimental-strip-types src/hooks/collab/apply-write-ops.core.test.ts`
预期：PASS

- [ ] **步骤 5：类型检查 + 提交**

运行：`npx tsc --noEmit`（预期无新增错误）
执行记录：（填写真实结果）
```bash
git add src/hooks/collab/apply-write-ops.core.ts src/hooks/collab/apply-write-ops.ts src/hooks/collab/apply-write-ops.core.test.ts src/store/resume/form.ts src/store/resume/const.ts
git commit -m "feat(collab): apply field-scoped write ops to Automerge doc via store action"
```

---

## 任务 5：聚焦注册 `focus-registry`

**文件：**
- 新建：`src/hooks/collab/focus-registry.ts`

职责：提供 `getActiveTextField()` → `{ name: string, el: HTMLInputElement | HTMLTextAreaElement } | null`。实现优先用 `document.activeElement`：若是 `input[type=text]`/`textarea` 且带 `name`（RHF `field.name`），返回之。无需全局订阅，读取即时状态即可（在 `useFormRemoteSync` 应用 setValue 前调用）。

> 该模块依赖 DOM，非纯函数，不写 node 单测；由任务 7 浏览器验证覆盖。保持极简。

- [ ] **步骤 1：实现 `getActiveTextField`**
- [ ] **步骤 2：类型检查**

运行：`npx tsc --noEmit`
执行记录：（填写）

- [ ] **步骤 3：提交**

```bash
git add src/hooks/collab/focus-registry.ts
git commit -m "feat(collab): add active text field lookup for caret preservation"
```

---

## 任务 6：共享 hook `useResumeFormSync`（整合读+写+光标）

**文件：**
- 新建：`src/hooks/collab/use-resume-form-sync.ts`
- 修改：`src/hooks/use-form-remote-sync.ts`（扩展：在对聚焦自由文本字段做 `setValue` 时保存/恢复光标）
- 参考：`src/pages/resume/editor/components/forms/hooks/use-resume-field-form.ts`

`useResumeFormSync(form, sectionKey, storeData, fieldArrays)`：
1. **读路径**：调用现有 `useFormRemoteSync(form, storeData, fieldArrays)` 得到 `isResettingRef`。在 `useFormRemoteSync` 内部，应用 `fieldUpdates` 时：对每个 `path`，若 `classifyLeaf(sectionKey, path)==='freeText'` 且该 path 恰为 `getActiveTextField()?.name` 且新旧均字符串 → setValue 后用 `mapCaretByDiff` + `requestAnimationFrame(setSelectionRange)` 恢复光标。需把 `sectionKey` 传入 `useFormRemoteSync`（新增可选参数）。
2. **写路径**：`useEffect(() => form.watch(...))`：
   - `if (isResettingRef.current) return`
   - `const base = useResumeStore.getState()[sectionKey]`（**实时**读取，避免陈旧闭包）
   - `const plan = planRemoteFormSync(base, value, Object.keys(fieldArrays))`
   - `if (plan 空) return`
   - `const ops = buildWriteOps(plan, sectionKey, classifyLeaf)`
   - `useResumeStore.getState().updateFormFields(sectionKey, value, ops)`
3. 返回 `{ isResettingRef }`（调用方一般不需要）。

> 保持 `useFormRemoteSync` 向后兼容：`sectionKey` 作为新增可选参数，缺省时跳过光标恢复（现有 `basic-resume` 等直接改用 `useResumeFormSync`，故都会传）。

- [ ] **步骤 1：扩展 `useFormRemoteSync` 支持光标保持**（新增可选 `sectionKey`、`classify`、`getActiveTextField` 注入点）
- [ ] **步骤 2：实现 `useResumeFormSync`**
- [ ] **步骤 3：类型检查**

运行：`npx tsc --noEmit`
预期：无新增错误
执行记录：（填写）

- [ ] **步骤 4：提交**

```bash
git add src/hooks/collab/use-resume-form-sync.ts src/hooks/use-form-remote-sync.ts
git commit -m "feat(collab): consolidate read+write+caret sync into useResumeFormSync"
```

---

## 任务 7：接线 5 处调用点

**文件（逐个改）：**
- 修改：`src/pages/resume/editor/components/forms/hooks/use-resume-field-form.ts`
- 修改：`src/pages/resume/editor/components/forms/basic-resume/index.tsx`
- 修改：`src/pages/resume/editor/components/forms/job-intent/index.tsx`
- 修改：`src/pages/resume/editor/components/forms/self-evaluation/index.tsx`
- 修改：`src/pages/resume/editor/components/forms/application-info/index.tsx`

改法：把每处「`useFormRemoteSync(form, storeData, fieldArrays)` + `useEffect(form.watch → updateForm(section, value))`」替换为单次 `useResumeFormSync(form, sectionKey, storeData, fieldArrays)`。删除内联 `watch` 写回块与 `updateForm` 依赖（改由 hook 内写路径完成）。`use-resume-field-form` 的 `fieldName` 即 `sectionKey`。

> `job-intent`/`application-info`/`self-evaluation`/`basic-resume` 无 `fieldArrays` 时传 `{}`；`basic-resume` 传 `{ customFields: {...} }`；`use-resume-field-form` 传 `{ [arrayFieldName]: {...} }`。

- [ ] **步骤 1：改 `use-resume-field-form.ts`（覆盖 8 个数组型 section）**
- [ ] **步骤 2：改 `basic-resume/index.tsx`**
- [ ] **步骤 3：改 `job-intent/index.tsx`**
- [ ] **步骤 4：改 `self-evaluation/index.tsx`**
- [ ] **步骤 5：改 `application-info/index.tsx`**
- [ ] **步骤 6：类型检查 + lint**

运行：`npx tsc --noEmit && pnpm lint`
预期：无错误
执行记录：（填写）

- [ ] **步骤 7：提交**

```bash
git add src/pages/resume/editor/components/forms
git commit -m "refactor(collab): wire all resume forms to field-scoped useResumeFormSync"
```

---

## 任务 8：全量校验 + 构建 + 浏览器双窗口验证

- [ ] **步骤 1：跑全部纯函数单测**

运行：`node --test --experimental-strip-types src/hooks/collab/classify-leaf.test.ts src/hooks/collab/text-caret-diff.test.ts src/hooks/collab/write-plan.test.ts src/hooks/collab/apply-write-ops.core.test.ts`
预期：全部 PASS
说明：这 4 个测试文件均不 import `@/` 别名或 app 运行时，故可脱离 vite 直接跑。执行器 `apply-write-ops.ts`（含 `@/` import）与各 hook/组件不写 node 测试，由步骤 5 浏览器路径验证。
执行记录：（填写）

- [ ] **步骤 2：类型检查**

运行：`npx tsc --noEmit`
预期：无错误
执行记录：（填写）

- [ ] **步骤 3：Lint**

运行：`pnpm lint`
预期：无错误（如有 auto-fixable 用 `pnpm lint:fix`）
执行记录：（填写）

- [ ] **步骤 4：生产构建**

运行：`pnpm build`
预期：构建成功
执行记录：（填写）

- [ ] **步骤 5：浏览器双窗口协作验证**（用 agent-browser 或本地两个窗口开同一协作 session；若环境不可用则在计划中注明限制）

逐条验证 spec §6 集成清单：
- A 改 `name`、B 改 `email`：互不覆盖、均不丢字符。
- A、B 同改 `name`（自由文本）：字符级合并、A 光标保持原位。
- A、B 同改同一 Select 枚举 / 日期：值不被拆分损坏（原子 LWW）。
- A 编辑某字段时 B 改其他字段：A 光标不动、B 值即时显示。
- 连续远端更新时 A 可持续输入。
- 数组尾部增删：其他项不重建。
- 富文本字段并发：不破坏 HTML；未并发时保持焦点。
执行记录：（填写每条结果；不通过则回到 systematic-debugging 修复后重跑步骤 1-4）

- [ ] **步骤 6：最终提交（若步骤 5 有修复）**

```bash
git add -A && git commit -m "test(collab): verify field-scoped sync end-to-end; fix issues"
```

---

## 完成标准（对齐 spec §7）

- A、B 编辑不同字段互不覆盖、均不丢输入。
- 同改同一自由文本字段按字符合并、聚焦方光标保持原位、可持续输入。
- 同改同一原子字段（枚举/日期/number）值不被拆分损坏。
- 编辑不同字段时聚焦控件 `document.activeElement` 与光标不变。
- 数组尾部增删与就地编辑不重建其他项（中间删除退化见 spec §3.6，属已知边界）。
- 无新增同步循环、重复广播、类型错误或构建错误。
- 富文本行为不回归。
