# 富文本输入触发预览缺失字段崩溃修复实施计划

> **给代理执行者：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐步实现本计划。步骤使用复选框（`- [ ]`）语法跟踪，执行时必须把本文件同步更新为最新状态。

**目标：** 阻止富文本输入把完整简历 section 替换成缺字段对象，并在加载及预览边界自动补齐旧简历缺失的结构字段。

**架构：** 在 schema 层新增结构驱动的无副作用规范化函数，供 store 加载转换与共享预览上下文复用；表单写路径改用 React Hook Form 的完整值订阅接口。按用户要求不采用 TDD，不新增测试框架，完成实现后再执行针对原始报错的数据回归、lint、类型检查和生产构建。

**技术栈：** TypeScript 5.9、React 19、React Hook Form 7.66、Zustand 5、Node 22、Vite 7

---

## 文件结构

- 新建 `src/lib/schema/resume/normalize.ts`：集中维护简历 section 默认结构，并提供结构规范化 API。
- 修改 `src/lib/schema/resume/index.ts`：从 schema 公共入口导出规范化 API。
- 修改 `src/store/resume/helpers/transform.ts`：加载 Automerge、离线及历史来源时补齐每个 section 的缺失结构。
- 修改 `src/components/resume/runtime/context/resume-data-context.tsx`：在共享预览边界再次规范化所有表单 section。
- 修改 `src/hooks/collab/use-resume-form-sync.ts`：以完整订阅值生成乐观状态和字段级 CRDT 写操作。
- 更新本计划文件：执行时勾选步骤并记录真实验证结果。

## 用户明确约束

- 不采用 TDD，不要求先写失败测试。
- 不引入 Vitest、Jest 或新的测试依赖。
- 保持当前分支，只允许本地提交，不执行 `git push`。
- 不修改 Tiptap UI、renderer 样式或协作协议。

---

### 任务 1：新增共享简历结构规范化函数

**状态：已完成**

**文件：**
- 新建：`src/lib/schema/resume/normalize.ts`
- 修改：`src/lib/schema/resume/index.ts`

- [x] **步骤 1：实现结构驱动的默认值合并**

在 `src/lib/schema/resume/normalize.ts` 中：

1. 引入 `ResumeSchema` 类型与 12 个 `DEFAULT_*` section 常量。
2. 建立 `RESUME_FORM_DEFAULTS`，键必须覆盖 `keyof ResumeSchema`。
3. 实现以下规则：
   - 默认值为数组时，只接受数组输入；否则返回默认数组的深拷贝。
   - 默认值为普通对象时，保留输入的额外键，并递归补齐默认对象的键。
   - 标量输入为 `null`/`undefined` 时回落默认值，否则保留输入。
   - 所有数组和对象都返回新引用，不修改输入或默认常量。
4. 导出：

```ts
export function normalizeResumeSection<K extends keyof ResumeSchema>(
  key: K,
  value: unknown,
): ResumeSchema[K]

export function normalizeResumeFormData(value: unknown): ResumeSchema
```

核心实现应保持纯函数边界：

```ts
function mergeWithDefaults(value: unknown, defaultValue: unknown): unknown {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(value)
      ? value.map(item => cloneValue(item))
      : defaultValue.map(item => cloneValue(item))
  }

  if (isRecord(defaultValue)) {
    const source = isRecord(value) ? value : {}
    const result = cloneValue(source) as Record<string, unknown>
    for (const [key, itemDefault] of Object.entries(defaultValue)) {
      result[key] = mergeWithDefaults(source[key], itemDefault)
    }
    return result
  }

  return value == null ? defaultValue : value
}
```

- [x] **步骤 2：从 schema 公共入口导出 API**

在 `src/lib/schema/resume/index.ts` 增加：

```ts
export * from './normalize'
```

- [x] **步骤 3：执行定向静态检查**

运行：

```bash
pnpm exec eslint src/lib/schema/resume/normalize.ts src/lib/schema/resume/index.ts --max-warnings 0
```

预期：退出码 0，无 lint error 或 warning。

执行记录：`pnpm exec eslint src/lib/schema/resume/normalize.ts src/lib/schema/resume/index.ts --max-warnings 0` 退出码 0，无输出。

- [x] **步骤 4：本地提交规范化基础能力**

```bash
git add src/lib/schema/resume/normalize.ts src/lib/schema/resume/index.ts docs/superpowers/plans/2026-07-26-rich-text-preview-missing-fields.md
git commit -m "fix: normalize incomplete resume sections"
```

不得执行 `git push`。

执行记录：已创建本地提交 `6e1da6d fix: normalize incomplete resume sections`，未执行 `git push`。

---

### 任务 2：在加载与预览边界应用结构规范化

**状态：进行中**

**文件：**
- 修改：`src/store/resume/helpers/transform.ts`
- 修改：`src/components/resume/runtime/context/resume-data-context.tsx`

- [x] **步骤 1：规范化 store 加载转换**

在 `mapSourceToPersistedSnapshot` 的 `FORM_DATA_KEYS` 循环中保留 snake_case/legacy key 选择逻辑，但把最终值交给 `normalizeResumeSection`：

```ts
const { legacyKey } = FORM_FIELD_DEFAULTS[key]
const value = get(source, key)
  ?? (legacyKey ? get(source, legacyKey) : undefined)

setFormDataField(
  formData,
  key,
  normalizeResumeSection(key, sanitizeDeep(value)),
)
```

这样缺失整个 section、缺少内部键、内部容器为 `null` 或容器类型错误时都会得到默认结构；合法值及额外兼容字段保留。

- [x] **步骤 2：规范化共享预览输入**

在 `buildTemplateResumeData` 中先调用 `normalizeResumeFormData(snapshot)`，再覆盖返回对象中的 12 个表单 section：

```ts
const formData = normalizeResumeFormData(snapshot)

return {
  ...snapshot,
  ...formData,
  templateBinding: resolveResumeTemplateBinding(snapshot.templateBinding, snapshot.type),
  getVisibility: id => snapshot.visibility[id] !== true,
}
```

不得在 renderer 中增加分散的可选链兜底。

- [x] **步骤 3：执行定向静态检查**

运行：

```bash
pnpm exec eslint src/store/resume/helpers/transform.ts src/components/resume/runtime/context/resume-data-context.tsx --max-warnings 0
```

预期：退出码 0，无 lint error 或 warning。

执行记录：`pnpm exec eslint src/store/resume/helpers/transform.ts src/components/resume/runtime/context/resume-data-context.tsx --max-warnings 0` 退出码 0，无输出。

- [ ] **步骤 4：本地提交边界接入**

```bash
git add src/store/resume/helpers/transform.ts src/components/resume/runtime/context/resume-data-context.tsx docs/superpowers/plans/2026-07-26-rich-text-preview-missing-fields.md
git commit -m "fix: repair legacy resume data at boundaries"
```

不得执行 `git push`。

---

### 任务 3：确保富文本写回使用完整 section 值

**文件：**
- 修改：`src/hooks/collab/use-resume-form-sync.ts`

- [ ] **步骤 1：替换不完整的 `watch(callback)` 写路径**

把 `form.watch` 订阅改为 `form.subscribe`：

```ts
useEffect(() => {
  return form.subscribe({
    formState: { values: true },
    callback: ({ values }) => {
      if (isResettingRef.current) {
        return
      }

      const base = useResumeStore.getState()[sectionKey] as unknown
      const plan = planRemoteFormSync(base, values, Object.keys(fieldArrays))

      if (plan.fieldUpdates.length === 0 && plan.fieldArrayOperations.length === 0) {
        return
      }

      const ops = buildWriteOps(plan, sectionKey as string, classifyLeaf)
      useResumeStore.getState().updateFormFields(
        sectionKey,
        values as unknown as FormDataMap[typeof sectionKey],
        ops,
      )
    },
  })
}, [form, sectionKey, isResettingRef, Object.keys(fieldArrays).join(',')])
```

保留现有远端回环抑制、实时读取 store 基线和字段数组路径依赖策略。不得回退到整段 Automerge 覆盖。

- [ ] **步骤 2：执行定向静态检查**

运行：

```bash
pnpm exec eslint src/hooks/collab/use-resume-form-sync.ts --max-warnings 0
```

预期：退出码 0，无 lint error 或 warning。

- [ ] **步骤 3：本地提交完整值订阅修复**

```bash
git add src/hooks/collab/use-resume-form-sync.ts docs/superpowers/plans/2026-07-26-rich-text-preview-missing-fields.md
git commit -m "fix: sync complete resume form values"
```

不得执行 `git push`。

---

### 任务 4：执行原始场景回归与完整工程验证

**文件：**
- 修改：`docs/superpowers/plans/2026-07-26-rich-text-preview-missing-fields.md`

- [ ] **步骤 1：执行旧数据结构回归验证**

使用已安装的 `jiti` 从 Node 直接加载 TypeScript 模块，并用 `node:assert/strict` 验证：

- `{ description: '<p>x</p>' }` 规范化为带 `certificates: []` 的荣誉证书对象。
- `skills: null`、`hobbies: null` 回落为空数组。
- `work_experience.items: null` 回落为 `DEFAULT_WORK_EXPERIENCE.items` 的等值新副本。
- 合法非空数组保持内容，输入和默认常量均未被修改。

运行时不得创建持久测试文件；把实际命令与断言结果追加到本计划的执行记录。

- [ ] **步骤 2：执行富文本同级数组保留回归**

使用现有 `planRemoteFormSync` 与 `buildWriteOps` 做一次性 Node 断言：当 `honors_certificates.description` 从空字符串变为富文本、`certificates` 保持不变时，写操作只包含 `description` 的 `setLeaf`，不得出现 `certificates` 的赋值、删除或数组操作。

把实际命令与断言结果追加到本计划的执行记录。

- [ ] **步骤 3：运行所有改动文件的定向 lint**

```bash
pnpm exec eslint \
  src/lib/schema/resume/normalize.ts \
  src/lib/schema/resume/index.ts \
  src/store/resume/helpers/transform.ts \
  src/components/resume/runtime/context/resume-data-context.tsx \
  src/hooks/collab/use-resume-form-sync.ts \
  --max-warnings 0
```

预期：退出码 0，无 error 或 warning。

- [ ] **步骤 4：运行仓库强制类型检查**

```bash
npx tsc --noEmit
```

预期：退出码 0，无 TypeScript 错误。

- [ ] **步骤 5：运行生产构建**

```bash
pnpm build
```

预期：退出码 0，Vite 生产构建完成；记录已有非阻塞警告，不把警告误报为成功或失败。

- [ ] **步骤 6：检查最终差异与提交状态**

```bash
git diff --check
git status --short
git log -5 --oneline
```

确认只包含规格、计划和本次修复文件；不得执行 `git push`。

- [ ] **步骤 7：提交最终计划执行记录（如有未提交变更）**

```bash
git add docs/superpowers/plans/2026-07-26-rich-text-preview-missing-fields.md
git commit -m "docs: record rich text preview fix verification"
```

不得执行 `git push`。

## 完成定义

- 旧简历缺失的 `certificates`、`skills`、`hobbies` 和经历 `items` 在读取时按各自默认结构补齐。
- Tiptap 富文本输入只更新目标描述字段，不丢失同级数组。
- 编辑器、历史、追踪和模板等共享预览入口不再因缺失结构字段读取 `.length`、`.map` 或 `.filter` 崩溃。
- 定向数据回归、定向 lint、`npx tsc --noEmit` 与 `pnpm build` 均有新鲜执行证据。
- 所有本地提交保留在当前分支，未执行任何远端推送。
