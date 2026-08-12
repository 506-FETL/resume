# 简历分享版本选择 · 设计规格

- 日期：2026-08-12
- 主题：resume-share-version
- 状态：已获用户批准，待规格审查
- 关联规格：`docs/superpowers/specs/2026-08-11-resume-share-link-design.md`

## 1. 背景

现有只读分享采用快照语义：创建链接时固化简历内容，后续编辑不会自动改变已发链接；所有者可以手动“推送最新版”。这保证了外部访问内容稳定，但当前创建和更新分享时只能读取简历的当前内容，不能选择该简历已有的历史版本，管理界面也无法说明每个链接发布了哪个版本。

历史版本能力已经具备以下基础：

- `resume_config_versions` 按简历保存完整 `PersistedResumeSnapshot`；
- 历史版本列表默认按 `version_no` 倒序加载元数据；
- 版本快照可以按需读取；
- 历史快照包含模板 binding、可见性与样式配置，能够复用现有分享快照的脱敏和模板固化流程。

## 2. 目标与成功标准

### 2.1 目标

让所有者在创建分享链接和更新已有链接时，从“当前版本 + 该简历全部历史版本”中明确选择一个发布版本。

### 2.2 已确认的产品语义

| 决策点 | 结论 |
|---|---|
| 链接与版本关系 | 一个链接在任一时刻只展示一个由所有者选定的版本；访问者不能切换版本 |
| 当前内容 | 版本选择器包含“当前版本”，并作为默认项 |
| 历史内容 | 可选择该简历的任一历史版本 |
| 链接更新 | 已有链接可重新选择版本，URL 与 token 保持不变 |
| 内容稳定性 | 分享仍保存独立脱敏快照，不动态读取历史版本表 |
| 删除历史版本 | 不影响已经发布的分享内容 |
| 版本信息可见性 | 版本来源只对所有者可见，匿名访问者只接收最终快照 |

### 2.3 成功标准

1. 编辑器快速分享与分享管理页都能按版本创建链接。
2. 已有链接能发布当前版本或任一历史版本，原 URL 不变。
3. 分享管理界面能在刷新后准确显示该链接的版本来源。
4. 删除来源历史版本后，链接仍能访问原快照并保留可理解的来源说明。
5. 发布失败不会导致快照和版本标识不一致，也不会破坏原链接内容。
6. 现有分享链接无需人工处理即可继续使用。

## 3. 方案选择

采用“独立快照 + 版本来源元数据”。

未采用的方案：

- **只保存选中快照，不记录来源**：改动少，但页面刷新后无法解释链接发布了哪个版本，管理语义不完整。
- **分享页动态读取历史版本**：版本被删除或未来可变时会改变已发链接，违背既有快照语义，并扩大匿名读取权限面。

独立快照承担稳定发布，版本元数据承担所有者侧的可追溯管理；二者职责分离。

## 4. 数据模型

在 `public.resume_shares` 增加以下列：

| 字段 | 类型 | 说明 |
|---|---|---|
| `source_kind` | text not null default `'current'` | `current` 或 `history` |
| `source_version_id` | bigint null | 来源历史版本 ID；外键删除时置空 |
| `source_version_no` | integer null | 发布时冗余保存的版本编号 |
| `source_version_name` | text null | 发布时冗余保存的版本名称 |
| `source_version_created_at` | timestamptz null | 发布时冗余保存的版本保存时间 |

约束：

- `source_kind` 只允许 `current`、`history`；
- `current` 的历史版本字段全部为空；
- `history` 必须有 `source_version_no` 与 `source_version_created_at`；
- `source_version_id` 引用 `resume_config_versions(id)`，`ON DELETE SET NULL`；由于编号、名称和保存时间已冗余，置空不影响管理界面解释来源。

迁移与权限：

- 既有分享记录通过默认值标记为 `current`；
- owner 的列级 `SELECT`、`INSERT`、`UPDATE` 权限增加上述来源字段；
- 匿名端仍不能直接读取 `resume_shares`；
- Edge Function 的匿名读取查询与响应均不增加来源字段。

## 5. 领域类型与边界

新增判别联合类型，避免用多个可空参数表达非法状态：

```ts
type ShareVersionSource =
  | { kind: 'current' }
  | {
      kind: 'history'
      versionId: number | null
      versionNo: number
      versionName: string | null
      versionCreatedAt: string
    }
```

新增发布输入类型，把内容与来源作为一个不可拆分的对象传递：

```ts
interface ResumeShareRelease {
  snapshot: PersistedResumeSnapshot
  templateManifest: TemplateManifest
  displayName: string | null
  source: ShareVersionSource
}
```

`ResumeShareRecord` 增加归一后的 `source`，UI 不直接组合数据库可空字段。数据库行到领域对象的转换集中在分享数据访问层。

## 6. 数据流

### 6.1 加载版本选项

分享页 Zustand store 按 `resumeId` 缓存历史版本元数据、加载状态与错误：

- 打开快速分享时并行加载该简历的分享链接与版本列表；
- 分享管理页选择简历后按需加载版本列表；
- 已缓存成功结果可复用；明确重试时重新请求；
- 加载失败不阻断“当前版本”，历史版本区域显示错误与重试入口。

版本列表只加载元数据，不预取快照。

### 6.2 解析发布内容

统一的 release resolver 根据选择构造 `ResumeShareRelease`：

- `current`
  - 编辑器快速分享：使用页面传入的内存 snapshot provider，保证包含尚未远端同步的最新编辑内容；
  - 分享管理页：使用 `getResumeSnapshotById` 读取云端当前内容。
- `history`
  - 使用版本 ID、当前用户和 resume ID 读取快照，避免跨简历误选；
  - 使用当前简历标题作为 `displayName`；
  - 将版本元数据写入 `source`。

两种来源随后统一经过现有流程：

1. 依据 visibility 清空隐藏模块；
2. 解析并固化模板 manifest；
3. 移除私有 owner 信息与 template binding；
4. 返回自包含的脱敏发布对象。

### 6.3 创建分享

创建分享时，`snapshot`、`template_manifest`、`display_name` 与全部来源字段在同一次 INSERT 中落库。带密码链接沿用“先创建未激活记录，再由 Edge Function 写入密码，成功后激活；失败则清理”的现有补偿流程。

### 6.4 更新已有链接

版本发布是独立动作，不与名称、密码、有效期设置合并：

1. 用户选择目标版本并确认；
2. resolver 完整构造 release；
3. `snapshot`、`template_manifest`、`display_name` 和来源字段在同一次 UPDATE 中写入；
4. token、URL、访问权限与统计不变；
5. 更新成功后，同时映射快速弹窗的 `shares` 与管理页的 `allShares`。

即使用户重新选择同一个 `current`，也执行发布，用于主动刷新当前内容快照。

## 7. 交互设计

### 7.1 版本选择器

新增复用组件 `version-selector`，用于快速创建、管理页创建和版本发布弹窗。

展示规则：

- 第一项固定为“当前版本”，默认选中；辅助文案说明链接内容不会自动更新；
- 历史版本按版本号倒序显示；
- 主文案：`V{version_no} · {version_name || milestone_name || '未命名版本'}`；
- 辅助文案：本地化保存时间；
- 没有历史版本时不额外显示空状态；
- 加载时显示轻量 spinner；失败时保留当前版本并提供重试。

选择另一份简历时，版本选择自动重置为“当前版本”，避免把前一份简历的版本 ID 带入新简历。

### 7.2 新建分享

- 快速分享表单在链接名称之前增加版本选择器；
- 分享管理页的新建弹窗在“选择简历”之后增加版本选择器；
- 提交期间锁定简历和版本选择，避免竞态；
- 描述文案从“当前快照”改为“所选版本的只读快照”。

### 7.3 已有链接

- 分享卡片、移动端列表和快速弹窗行显示“当前版本”或 `Vx · 版本名称`；
- 版本来源使用紧凑 badge，不与链接状态、密码状态混淆；
- 把“推送最新版”统一替换为“更换分享版本”；
- 打开独立 `version-dialog`，默认定位到当前来源；
- 主按钮文案为“发布所选版本”；
- 当前来源历史版本已删除时，展示保留的版本编号/名称并标记“原版本已删除”，用户仍可选择其他现存版本。

访问设置弹窗继续只处理名称、有效期和密码。这样修改访问权限不会隐式发布编辑中的内容。

## 8. 组件与状态组织

遵循现有 share 页面模块结构：

- `src/pages/share/components/version-selector/index.tsx`
  - 纯展示和选择；依赖版本选项、选中值、加载/错误与 retry 回调。
- `src/pages/share/components/version-dialog/index.tsx`
  - 根据当前 share 初始化选项，解析并发布选中版本；接收当前版本 snapshot provider 以区分编辑器内存态与管理页云端态。
- `src/pages/share/store/data.ts`
  - 加载/缓存版本元数据；创建带来源分享；发布版本并映射列表。
- `src/pages/share/store/ui.ts`
  - 管理版本弹窗的打开状态与目标 share ID。
- `src/lib/supabase/resume/share.ts`
  - 数据库行归一、release resolver、创建与原子发布。

版本列表属于分享工作流的跨组件页面状态，因此进入 share Zustand store；表单输入、弹窗内当前选择与密码显隐仍使用组件本地状态。

## 9. 异常与并发

- 版本列表失败：当前版本仍可选；历史区域显示错误与重试。
- 版本在选择后被删除：快照查询失败，保留弹窗与原链接内容，提示版本已不存在并刷新选项。
- 历史快照与 resume ID 不匹配：查询按两者共同过滤，按不存在处理。
- 自定义模板无法解析：不发布，显示已有明确错误。
- 重复提交：沿用 `pendingShareIds` 阻止同一链接并发写。
- 发布中关闭弹窗：禁用关闭或等待请求完成，避免成功结果缺少 UI 反馈。
- 原子性：内容和来源字段只通过单次 INSERT/UPDATE 写入；失败时数据库保留原 release。
- 历史版本删除：外键 ID 置空，独立分享快照与冗余来源信息保留。
- 来源为当前版本：它仍是发布时快照，不自动跟随编辑；UI 提示该语义。

## 10. 验证策略

项目当前没有测试运行器。本功能引入与 Vite 配套的最小 Vitest 配置，不引入 DOM 或端到端测试框架。

单元测试覆盖：

- 数据库行到 `ShareVersionSource` 的归一；
- `ShareVersionSource` 到数据库 patch 的转换；
- 当前版本与历史版本的显示文案；
- 发布成功后 `shares`、`allShares` 的一致映射；
- 历史来源 ID 被置空后仍保留可读信息。

静态验证：

- `pnpm test --run`；
- `pnpm lint`；
- `pnpm build`。

手工验收矩阵：

1. 编辑器内用尚未同步的当前内容创建分享；
2. 快速分享选择历史版本创建链接；
3. 分享管理页选择简历后选择历史版本创建链接；
4. 已有链接从当前版本切换到历史版本，URL 不变；
5. 已有链接从历史版本切换到当前版本，URL 不变；
6. 对当前版本执行再次发布，访问内容更新；
7. 删除来源历史版本后，分享仍能访问并显示“原版本已删除”；
8. 模拟列表、快照或模板加载失败，确认原链接不变；
9. 验证桌面端和移动端的版本 badge、选择器与弹窗布局；
10. 验证匿名响应不包含版本来源字段。

## 11. 非目标

- 不允许访问者切换或查看历史版本列表；
- 不把一个链接扩展为多版本合集；
- 不让链接动态追踪当前简历或历史版本表；
- 不改变密码、有效期、撤销、访问统计与 PDF 下载语义；
- 不新增版本评论、版本比较或分享审计日志；
- 不重构与分享版本选择无关的历史页和简历编辑器。

## 12. 预估文件范围

新增：

- `supabase/migrations/20260812xxxxxx_add_resume_share_version_source.sql`
- `src/pages/share/components/version-selector/index.tsx`
- `src/pages/share/components/version-dialog/index.tsx`
- 分享版本来源的纯函数测试文件与最小 Vitest 配置

修改：

- `package.json`、`pnpm-lock.yaml`
- `src/lib/supabase/resume/share.types.ts`
- `src/lib/supabase/resume/share.ts`
- `src/lib/supabase/resume/history/queries.ts`
- `src/pages/share/store/types.ts`
- `src/pages/share/store/data.ts`
- `src/pages/share/store/ui.ts`
- `src/pages/share/components/quick-dialog/*`
- `src/pages/share/components/create-dialog/index.tsx`
- `src/pages/share/components/card/index.tsx`
- `src/pages/share/components/mobile-list/*`
- `src/pages/share/index.tsx`

