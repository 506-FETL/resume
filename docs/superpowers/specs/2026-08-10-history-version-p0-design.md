# 历史版本 P0：版本对比 + 保存去重 设计

- 日期：2026-08-10
- 来源：`docs/superpowers/specs/2026-08-10-history-version-critique.md` 的 P0 切片
- 范围：仅 `/history` 历史页；**不动**编辑器工具栏下拉、助手画布、schema、持久层
- 目标：把「备份流水」升级为可用的「版本历史」——能看两版差异、避免存重复版本

---

## 一、功能 1：保存去重

### 行为
历史页手动保存当前版本时，若内容与**最新版本**（`versions[0]`）完全一致，则不落库，提示用户。

### 实现
- 位置：`src/pages/history/store/history-data.ts` 的 `saveCurrentVersion`。
- 逻辑：保存前先算 `nextHash = await createResumeSnapshotHash(currentResume.snapshot)`（本来保存时就要算，提前到比对处，只算一次）。
  - 取 `latest = versions[0]`（store 中 `versions` 按 `version_no desc`，最新在首）。
  - 若 `latest?.content_hash && latest.content_hash === nextHash` → 不发请求，`toast.info('当前内容与最新版本 V{latest.version_no} 一致，无需保存')`，`return null`。
  - 否则照常 `createResumeHistoryVersion(...)`，复用已算出的 `nextHash` 作为 `content_hash`（避免重复计算）。
- 边界：
  - `content_hash` 缺失（历史旧数据为 null）→ 不阻止保存（视为不同）。
  - `crypto.subtle` 不可用时 `createResumeSnapshotHash` 回退为原文串（`snapshot.ts:48`），比对仍成立。

### 不做（YAGNI）
- 不改 AI 工具 `save_current_resume_version` 的保存路径（P1 收敛时统一）。
- 不做「跨任意两版」去重，只比最新版。

---

## 二、功能 2：版本对比视图（任意两版）

### 入口
`src/pages/history/components/detail-panel/detail-header.tsx` 非 current 分支的操作区，在「查看内容」旁新增**「对比」**按钮（`GitCompare` 图标）。移动端与「查看内容」一样并入按钮网格。

### 交互
点「对比」打开对比弹窗：
- 顶部两个选择器：**左＝基准版**（默认选中「上一版」，即 `version_no` 比当前选中版小的最近一版；若为最早版则回退到「当前内容」），**右＝目标版**（默认＝当前详情选中的版本）。
- 两个选择器的候选项：全部历史版本（`V{n} · 来源 · 日期`）+「当前内容」（用 `currentResume.snapshot`）。
- 顶部显示总统计「共 N 处字段改动（+X / -Y 行）」。
- 主体：**按 section → 字段** 逐块渲染，仅显示**有变化**的字段；每块用现有 `DiffView(before, after)` 出行级红绿。无任何变化时显示空态「两个版本内容一致」。

### 数据与算法（新文件，避免塞进现有大文件）
- `src/pages/history/utils/compare.ts`
  - `diffSnapshots(before: ResumeSnapshot, after: ResumeSnapshot): SectionDiff[]`
    - 用现有 `getOrderedSections`（对 before/after 的 section key 取并集，保持既有顺序）遍历。
    - 每个 section 内，按字段（复用 `SnapshotPreview` 的字段遍历思路：对象取 entries，`items` 数组按项展开）对 `before/after` 逐字段调用 `computeLineDiff` + `diffStat`。
    - 只保留 `additions+deletions>0` 的字段，产出 `{ sectionKey, sectionLabel, fields: [{ fieldLabel, before, after, stat }] }`。
    - section/field label 复用 `SECTION_LABEL_MAP`/`FIELD_LABEL_MAP`。
  - `totalDiffStat(diffs): { changedFields, additions, deletions }`。
- 复用：`computeLineDiff`、`diffStat`（`src/pages/assistant/components/diff/compute-line-diff.ts`）、`DiffView`（同目录 `diff-view.tsx`）。

### 组件（新文件，遵循页面模块规范）
- `src/pages/history/components/compare-dialog/index.tsx`
  - props：`open`、`onOpenChange`、`baseVersionId`（触发时预置为「上一版」）、`targetVersionId`（预置为选中版）。
  - 用 `ResponsiveDialog`（与派生弹窗同款，桌面对话框/移动 Drawer 自适应）。
  - 从 `useHistoryStore` 读 `versions` 与 `currentResume`；把选择器的选项映射为 snapshot；调用 `diffSnapshots` 渲染。
- 在 `detail-header.tsx` 用本地 `useState` 管理 `compareOpen`，与现有 `previewTarget` 等状态并列。

### 边界
- 版本数 < 2 且无「当前内容」可比 → 「对比」按钮禁用并 tooltip「暂无可对比的版本」。
- 两侧选同一个 → 空态「两个版本内容一致」。
- 富文本字段（HTML 串）：`computeLineDiff` 已按行 diff 文本，HTML 作为纯文本行比较即可（P0 不做富文本渲染级 diff）。

---

## 三、影响面与验证

### 改动文件
- 改：`src/pages/history/store/history-data.ts`（去重）、`detail-header.tsx`（对比入口按钮 + 状态）。
- 增：`src/pages/history/components/compare-dialog/index.tsx`、`src/pages/history/utils/compare.ts`。
- 不改：schema、`snapshot.ts`、持久层、其它两套 UI、AI 工具路径。

### 验证
- `npx tsc --noEmit` + `npx eslint <改动文件>` 全绝。
- `diffSnapshots` 用独立 node 脚本做几个用例（改一个字段、加一条经历、删一条、完全相同）验证输出正确后再接 UI。
- 本仓库默认不写测试文件，验证脚本跑完即删。

### 非目标（明确排除，属后续 P1–P3）
- 三套 UI 收敛、抽 `useRestoreVersion`、清 `ai_optimize`/`import` 死代码、搜索/筛选、分页/保留、导出 PDF、版本↔岗位打通。
