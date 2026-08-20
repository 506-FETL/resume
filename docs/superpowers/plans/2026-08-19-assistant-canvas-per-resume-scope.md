# 实现计划：助手画布按简历隔离

日期：2026-08-19
关联设计：`docs/superpowers/specs/2026-08-19-assistant-canvas-per-resume-scope-design.md`

## 执行顺序

### 步骤 1：类型扩展 `CanvasChange.resumeId`
文件：`src/pages/assistant/types.ts`
- 在 `CanvasChange` 接口加 `resumeId?: string`（该变更所属简历；看板 / 读操作可无）。

### 步骤 2：写工具结果补 `resumeId`
文件：`src/lib/ai/tools/resume.ts`
- `update_current_resume_field` 的 `apply()` 返回增加 `resumeId: currentId`。

文件：`src/lib/ai/tools/crud.ts`
- `save_current_resume_version` 的 `apply()` 返回增加 `resumeId`（= 步骤内 `resumeId` 变量）。
- `restore_current_resume_version` 的 `apply()` 返回增加 `resumeId`。
- `delete_resume_version`：在 `execute` 开头取 `resolveActiveResumeId()`，`apply()` 返回带上（尽力归属；为空则不带）。

（`create_resume` / `update_resume_meta` / `delete_resume` 已含 `resumeId`，无需改。）

### 步骤 3：`deriveCanvasModel` 加简历作用域
文件：`src/pages/assistant/utils.ts`
- 新增内部 helper：从 `part.result` / `part.args` 解析目标 `resumeId`。
- push `CanvasChange` 时带上解析出的 `resumeId`。
- 函数签名加第三参 `scopeResumeId: string | null = null`。
- 计算 `changes` 后按设计规则过滤成 `scopedChanges`：board 与 read 恒保留；resume/version
  当 `scopeResumeId` 与 `change.resumeId` 均存在且不等时剔除。
- `writes` / `touchedBoard` / `touchedVersion` / `hasWrites` 全部基于 `scopedChanges`。
- `changes` 返回过滤后的集合（对外只暴露与当前作用域一致的视图）。

### 步骤 4：`useCanvasModel` 传入 previewResumeId
文件：`src/pages/assistant/hooks/use-canvas-model.ts`
- 读取 `previewResumeId`，作为 `scopeResumeId` 传入 `deriveCanvasModel`，加入 `useMemo` 依赖。

### 步骤 5：验证
- `pnpm exec tsc -p tsconfig.app.json --noEmit`
- `pnpm exec eslint src/pages/assistant/utils.ts src/pages/assistant/hooks/use-canvas-model.ts src/pages/assistant/types.ts src/lib/ai/tools/resume.ts src/lib/ai/tools/crud.ts`

## 回归风险与对策
- 历史遗留结果无 `resumeId`：过滤规则中「change.resumeId 为空则保留」兜底，不隐藏旧改动。
- `update_current_resume_field` 撤销载荷判定独立于 `resumeId`，互不影响（同为 result 的字段）。
- 看板需求：board 类恒保留，`touchedBoard` 不受简历过滤影响。
