# 助手画布按简历隔离（变更记录 / 标签随预览简历切换）

日期：2026-08-19
状态：已批准，进入实现

## 背景与问题

AI 助手右侧「画布」应当「每个画布对应一份简历」：当会话正在操作的简历切换时（AI 调用
`open_resume` / `create_resume`，或会话绑定简历变化 → `previewResumeId` 变化），画布里
所有与该简历相关的信息都应随之切换。

现状：只有「简历预览」正确跟随 `previewResumeId` 切换；而「变更记录」（ChangeLog）
及标签可见性来自 `deriveCanvasModel(messages, streamingParts)`——它把**整条会话里所有
工具调用**聚合成一个模型，不区分目标简历。结果：切到简历 B 后，变更记录仍显示简历 A
的字段改动、历史版本操作等，与预览不一致。

## 目标

- 变更记录、历史版本标签等**与简历强相关**的画布内容，按「当前画布正在预览的简历」
  （`previewResumeId`）过滤，只显示属于该简历的改动。
- 「求职看板」类改动（`create_job` / `update_job` / `delete_job`）**保持全局可见**，
  不随简历切换而隐藏（用户明确要求「求职看板保持不变，能看到所有的进度」）。
- 读操作（category=read）不进入变更记录，维持现状。

## 非目标

- 不改变会话与简历的绑定机制（`conversation.resumeId` / `resolveActiveResumeId`）。
- 不新增「手动切换预览简历」的下拉（当前切换仍由 AI 工具 / 全局当前简历驱动）。
- 不为历史遗留（改动前已落库、结果里没有 `resumeId`）的工具结果做数据迁移。

## 设计

### 1. 每条变更携带目标简历 `resumeId`

`CanvasChange` 增加可选字段 `resumeId?: string`。在 `deriveCanvasModel` 里为每条
tool-call 解析目标简历：

- 优先取 `result.resumeId`（执行期真实目标，最可靠）；
- 回退取 `args.resumeId`（`update_resume_meta` / `delete_resume` 等以 resumeId 入参的工具）。

为让「修改当前简历字段」「保存 / 恢复 / 删除历史版本」等**不带 resumeId 入参**的写工具
可被归属，需在其 `apply()` 结果里补写执行期的 `resolveActiveResumeId()`：

| 工具 | 现状结果 | 补充 |
|------|----------|------|
| `update_current_resume_field` | `{ ok, sectionKey, before, after }` | + `resumeId`（= 执行期 currentId） |
| `save_current_resume_version` | `{ ok, versionNo }` | + `resumeId` |
| `restore_current_resume_version` | `{ ok, restoredFrom }` | + `resumeId` |
| `delete_resume_version` | `{ ok, versionId }` | + `resumeId`（尽力：执行期绑定简历） |
| `create_resume` / `update_resume_meta` / `delete_resume` | 已含 `resumeId` | 无需改 |

注意：`update_current_resume_field` 结果补 `resumeId` 不能破坏「可撤销载荷」的判定
（`deriveCanvasModel` 里通过 `result.sectionKey` + `before` 生成 `undo`），二者独立字段互不影响。

### 2. `deriveCanvasModel` 增加简历作用域过滤

签名扩展为 `deriveCanvasModel(messages, streamingParts = [], scopeResumeId: string | null = null)`。

过滤规则（作用于 `changes` → 再派生 `writes` / touched* / hasWrites）：

- `category === 'board'`：**始终保留**（全局看板进度）。
- `category === 'read'`：保留（本就不进 writes）。
- 其余（`resume` / `version`）：
  - `scopeResumeId` 为空 → 保留（未解析出当前简历时不误伤）；
  - 该变更 `resumeId` 为空（历史遗留）→ 保留（避免隐藏旧会话的合法改动）；
  - 否则仅当 `change.resumeId === scopeResumeId` 时保留。

`writes`、`touchedBoard`、`touchedVersion`、`hasWrites` 全部基于过滤后的集合派生，
使标签可见性与列表内容一致。

### 3. `useCanvasModel` 传入当前画布简历

`useCanvasModel` 反应式读取 `previewResumeId`，作为 `scopeResumeId` 传入
`deriveCanvasModel`，并纳入 `useMemo` 依赖。这样预览简历切换时，画布模型（及
其驱动的变更记录、标签、`use-canvas-preview` 的 `resumeWriteCount`）同步收敛到该简历。

## 数据流

```
conversation.resumeId ──► boundResumeId ──► useCanvasPreview 解析 ──► previewResumeId(store)
                                                                          │
                              ┌───────────────────────────────────────────┘
                              ▼
        useCanvasModel(previewResumeId) ──► deriveCanvasModel(msgs, streaming, scope)
                              │
              ┌───────────────┼─────────────────────────────┐
              ▼               ▼                             ▼
        ResumePreview     ChangeLog(model.writes)      CanvasTabs(model.touched*/hasWrites)
        （已按预览切换）    （现按简历过滤）              （现按简历过滤）
```

## 影响与验证

- 影响文件：`types.ts`、`utils.ts`（derive）、`use-canvas-model.ts`、`tools/resume.ts`、
  `tools/crud.ts`。看板工具 `tracker.ts` 不改（保持全局）。
- 兼容性：新增字段与参数均可选，旧数据不解析出 `resumeId` 时按「保留」处理，不回归。
- 验证：`tsc --noEmit` 全量类型检查 + `eslint` 相关文件；人工验收由用户完成
  （切换 / 新建简历后确认变更记录随之切换、看板改动仍可见）。
