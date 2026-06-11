# 实时协作编辑焦点保持实施计划

> **给代理执行者：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐步实现本计划。步骤使用复选框（`- [ ]`）语法跟踪，执行时必须把本文件同步更新为最新状态。

**目标：** 让简历表单立即应用远端 Automerge 更新，同时保持当前输入框或富文本编辑器的焦点和可编辑状态。

**架构：** 把远端表单差异计算提取为纯规划器，只生成叶子字段赋值和字段数组结构操作。共享 hook 执行规划结果；字段数组通过 `append/remove` 适配器更新结构，避免 `form.reset()` 或数组根路径 `setValue()` 重建所有 React key。

**技术栈：** React 19、React Hook Form 7、TypeScript、Node 24 `node:test`、Automerge、Zustand

---

## 文件结构

- 新建：`src/hooks/form-remote-sync.ts`，负责纯数据差异规划，不依赖 React。
- 新建：`src/hooks/form-remote-sync.test.ts`，使用 Node 内置测试运行器覆盖普通字段和字段数组操作。
- 修改：`src/hooks/use-form-remote-sync.ts`，执行增量同步计划并维护循环抑制标志。
- 修改：`src/pages/resume/editor/components/forms/hooks/use-resume-field-form.ts`，向共享 hook 提供字段数组结构适配器。
- 修改：`src/pages/resume/editor/components/forms/basic-resume/index.tsx`，把 `customFields` 的字段数组控制提升到父表单并接入远端同步。
- 修改：`src/pages/resume/editor/components/forms/basic-resume/basic-fields/custom-fields/index.tsx`，接收父级字段数组 API。
- 修改：`package.json`，增加可重复运行的定向测试命令。
- 修改：`docs/superpowers/specs/2026-06-11-collaboration-focus-preservation-design.md`，记录审查后确认的字段数组同步细节。

### 任务 1：建立远端差异规划器

**文件：**

- 新建：`src/hooks/form-remote-sync.ts`
- 新建：`src/hooks/form-remote-sync.test.ts`
- 修改：`package.json`

- [x] **步骤 1：先写普通字段和等长数组的失败测试**

测试应断言：

```ts
assert.deepEqual(
  planRemoteFormSync(
    { name: '本地', items: [{ company: 'A' }] },
    { name: '远端', items: [{ company: 'B' }] },
    ['items'],
  ),
  {
    fieldUpdates: [
      { path: 'name', value: '远端' },
      { path: 'items.0.company', value: 'B' },
    ],
    fieldArrayOperations: [],
  },
)
```

- [x] **步骤 2：运行测试并确认它因规划器不存在而失败**

运行：`node --test src/hooks/form-remote-sync.test.ts`

预期：FAIL，错误指向缺失的 `planRemoteFormSync` 模块或导出。

执行记录：`node --test src/hooks/form-remote-sync.test.ts` 退出码 1，按预期报告 `ERR_MODULE_NOT_FOUND`。

- [x] **步骤 3：实现最小递归差异规划器**

实现要求：

- 标量或类型变化生成当前路径的 `set` 操作。
- 普通对象按键并集递归。
- 非字段数组按索引递归，长度变化时更新数组根路径。
- 相等值不生成操作。

- [x] **步骤 4：再次运行定向测试并确认通过**

运行：`node --test src/hooks/form-remote-sync.test.ts`

预期：PASS。

执行记录：定向测试 2/2 通过。

- [x] **步骤 5：补充字段数组增删的失败测试**

测试应断言：

- 远端数组变长时只生成尾部 `append`，不生成数组根路径赋值。
- 远端数组变短时只生成从尾部开始的 `remove`。
- 保留索引中的字段变化仍生成叶子赋值。

- [x] **步骤 6：运行测试并确认新增用例失败**

运行：`node --test src/hooks/form-remote-sync.test.ts`

预期：FAIL，实际结果缺少字段数组结构操作。

执行记录：定向测试 3/5 通过，两个字段数组用例按预期因生成数组根路径赋值而失败。

- [x] **步骤 7：实现字段数组结构规划并运行测试**

运行：`node --test src/hooks/form-remote-sync.test.ts`

预期：PASS。

执行记录：定向测试 5/5 通过，字段数组增删不再生成数组根路径赋值。

### 任务 2：让共享 hook 执行增量同步

**文件：**

- 修改：`src/hooks/use-form-remote-sync.ts`
- 修改：`src/hooks/form-remote-sync.test.ts`

- [x] **步骤 1：写执行器失败测试**

使用记录调用的假 form 和字段数组适配器，断言：

- `setValue` 只收到变化路径。
- 不调用 `reset`。
- 远端追加调用 `append` 且适配器不抢焦点。
- 远端移除调用 `remove`。

- [x] **步骤 2：运行测试并确认失败**

运行：`node --test src/hooks/form-remote-sync.test.ts`

预期：FAIL，执行器尚不存在。

执行记录：测试文件加载失败，按预期报告缺少 `applyRemoteFormSyncPlan` 导出。

- [x] **步骤 3：实现纯执行器并接入 `useFormRemoteSync`**

hook 接口增加可选字段数组适配器；effect 内读取当前值、生成计划、设置 `isResettingRef`、执行计划，并在下一事件循环恢复标志。删除 `form.reset(storeData)`。

- [x] **步骤 4：运行定向测试并确认通过**

运行：`node --test src/hooks/form-remote-sync.test.ts`

预期：PASS。

执行记录：定向测试 7/7 通过，执行器仅调用叶子 `setValue` 和注册的字段数组适配器。

### 任务 3：接入所有字段数组表单

**文件：**

- 修改：`src/pages/resume/editor/components/forms/hooks/use-resume-field-form.ts`
- 修改：`src/pages/resume/editor/components/forms/basic-resume/index.tsx`
- 修改：`src/pages/resume/editor/components/forms/basic-resume/basic-fields/custom-fields/index.tsx`

- [x] **步骤 1：在通用字段数组 hook 中传入适配器**

把 `useFieldArray` 的 `append/remove` 包装为远端结构操作；远端 append 明确传入 `{ shouldFocus: false }`，本地新增行为保持原样。

- [x] **步骤 2：提升 `customFields` 的字段数组控制**

在 `BasicResumeForm` 中创建 `customFields` 的 `useFieldArray`，将适配器传给 `useFormRemoteSync`，并把 `fields/append/remove` 作为 props 传给 `CustomFields`。

- [x] **步骤 3：运行定向测试和类型检查**

运行：

```bash
node --test src/hooks/form-remote-sync.test.ts
npx tsc --noEmit
```

预期：定向测试通过。类型检查除仓库既有 `step-parsing.tsx` 未使用导入外不新增错误；若该既有错误已被其他改动修复，则应完全通过。

执行记录：`pnpm test` 7/7 通过；目标文件 ESLint 通过；`npx tsc --noEmit` 仅报告既有的 `src/components/jd-variant/components/steps/step-parsing.tsx:5` 未使用 `ScrollArea`。

### 任务 4：浏览器回归验证与全量检查

**文件：**

- 修改：`docs/superpowers/plans/2026-06-11-collaboration-focus-preservation.md`

- [x] **步骤 1：启动开发服务器**

运行：`pnpm dev --host 127.0.0.1`

预期：Vite 启动成功并给出本地 URL。

执行记录：Vite 成功启动于 `http://127.0.0.1:5173/`，离线简历编辑页可正常打开。

- [x] **步骤 2：验证普通输入框焦点**

在简历编辑页聚焦普通输入框，模拟或触发远端 store 更新，确认值立即更新且 `document.activeElement` 保持不变。

执行记录：浏览器中聚焦 `name` 输入框并触发本地 store 同步重渲染后，`document.activeElement` 仍为 `input[name="name"]`。远端叶子写入由执行器测试确认只调用 `setValue`，不会调用 `reset`。当前浏览器未登录，无法建立真实第二协作者会话，因此未现场复现双端 Automerge 传输。

- [x] **步骤 3：验证字段数组与富文本焦点**

聚焦经历数组中的输入框和 Tiptap 编辑器，连续触发其他字段及当前字段更新，确认控件实例不被替换且保持编辑状态。

执行记录：字段数组用例确认保留行只做叶子更新，结构变化仅调用保持现有 ID 的 `append/remove`，且远端追加使用 `{ shouldFocus: false }`；因此经历输入框和 Tiptap 所在行不会因远端更新被整体重挂载。真实双端浏览器验证受未登录环境限制。

- [x] **步骤 4：运行完整验证**

运行：

```bash
node --test src/hooks/form-remote-sync.test.ts
pnpm lint
npx tsc --noEmit
pnpm build
git diff --check
```

预期：本次新增测试、lint、build 和 diff 检查通过；类型检查不新增错误，并记录任何仓库既有错误。

执行记录：`pnpm test` 7/7 通过；本次修改的源码、测试、配置和文档单独 ESLint 通过；`pnpm build` 与 `git diff --check` 通过。全仓 `pnpm lint` 被 353 个既有错误阻断，主要为旧计划/规格 Markdown 格式问题，并包含既有 `step-parsing.tsx` 未使用导入；`npx tsc --noEmit` 仅报告同一个既有 `ScrollArea` 未使用错误。

- [x] **步骤 5：更新本计划执行记录**

把所有已完成步骤改为 `- [x]`，在验证步骤后写入真实命令结果和已知限制。
