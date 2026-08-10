# 历史版本 P2 #6：版本→投递关联 设计

- 日期：2026-08-10
- 来源：`docs/superpowers/specs/2026-08-10-history-version-critique.md` P2 #6，经调研收敛
- 范围：给「历史版本」加「关联岗位 + 投递日期」两项元信息；**不做**一键派生（已有 jd-variant 覆盖）
- 文案原则：用户可见文案轻量口语化，不出现术语味措辞

---

## 一、目标与非目标

**目标：** 版本可回答「这一版投给了哪个岗位、什么时候投的」。
- `company_id`：关联到求职看板里的一个岗位（`company` 表）。
- `submitted_at`：投递日期（日精度）。

**非目标（明确排除）：**
- 一键派生新变体 —— 已有独立 JD 派生功能，不重复造。
- 新建版本弹窗（save-version-dialog）设置这两项 —— 保持新建轻量，仅在「编辑信息」里设。
- 岗位侧反向展示「这个岗位投了哪些版本」—— 后续可选，本轮不做。

---

## 二、数据层（DB 迁移）

新增 `supabase/migrations/<timestamp>_add_version_job_link.sql`，仿 `20260528000001_add_resume_variant_columns.sql` / `20260728000002_add_company_next_action.sql` 的既有 idiom：

```sql
-- 为历史版本增加「关联岗位 + 投递日期」；均 nullable，老数据不受影响

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

- `ON DELETE SET NULL`：岗位被删除时，版本保留、关联自动清空。
- 无 `IF NOT EXISTS` on FK（Postgres 不支持具名约束的 IF NOT EXISTS，与仓库现有迁移一致）。
- **需执行迁移**（`supabase db push` 或等价）才生效——这是本切片最重的一步。

---

## 三、类型 + 查询层

`src/lib/supabase/resume/history/types.ts`：
- `ResumeHistoryVersionBase<T>` 加 `company_id: string | null`、`submitted_at: string | null`（Row/Record 自动继承）。
- `CreateResumeHistoryVersionInput`、`UpdateResumeHistoryVersionInput` 各加 `company_id?: string | null`、`submitted_at?: string | null`。

`src/lib/supabase/resume/history/queries.ts`：
- `VERSION_SELECTOR` 追加 `company_id, submitted_at`（`VERSION_SUMMARY_SELECTOR` 不动，跨简历摘要用不到）。
- `createResumeHistoryVersion` insert map 加 `company_id: input.company_id ?? null`、`submitted_at: input.submitted_at ?? null`。
- `updateResumeHistoryVersion` update map 加同样两项。

---

## 四、Draft + 工具函数

`src/pages/history/types.ts` 的 `VersionMetadataDraft` 加：
- `companyId: string | null`
- `submittedAt: string | null`（ISO 日期串 `YYYY-MM-DD` 或 null）

`src/pages/history/utils.ts`（四处，缺一不可）：
1. `createMetadataDraft` — seed `companyId: version?.company_id ?? null`、`submittedAt: version?.submitted_at ?? null`。
2. `normalizeDraft`（私有，dirty 比较用）— 纳入这两字段，否则编辑它们不会点亮「保存」。
3. `toVersionMutationPayload` — 输出 `company_id: draft.companyId || null`、`submitted_at: draft.submittedAt || null`。
4. `applyMetadataDraftPatch` — 无需改（泛型 spread 已覆盖标量字段）。

---

## 五、UI

### 编辑态（`shared/version-metadata-fields/index.tsx`，复用现有 Field 布局）
新增两个 `Field`：
- **关联岗位**：`Select`（`@/components/ui/select`），选项来自 `listJobApplicationSummaries()`，每项显示「公司 · 职位」；含一个「不关联」空选项（值为空→写 null）。组件内一次性拉取岗位列表（不依赖 tracker store 是否已加载）。
- **投递日期**：`Popover` + `Calendar`（日精度）触发按钮显示已选日期或「选择日期」，带「清除」。输出 `YYYY-MM-DD`。

### 只读态（`detail-panel/history-overview.tsx`）
新增两个 `MetricCard`：
- **关联岗位**：显示「公司 · 职位」；未关联显示「未关联」。若关联的岗位已被删（`company_id` 仍在但查不到）显示「岗位已删除」。
- **投递日期**：显示日期；未填显示「未记录」。

### 岗位名解析
`history-overview` 与 `version-metadata-fields` 都需把 `company_id` 映射到「公司·职位」文案。用一个轻量 hook `useJobSummaries()`（封装 `listJobApplicationSummaries()` + 缓存），两处共用，避免各拉一次。

---

## 六、影响面 / 边界 / 验证

### 改动文件
- 增：迁移 sql、`hooks/use-job-summaries.ts`（岗位列表）。
- 改：`history/types.ts`(lib)、`queries.ts`、`pages/history/types.ts`、`pages/history/utils.ts`、`version-metadata-fields/index.tsx`、`history-overview.tsx`。
- 不改：save-version-dialog、tracker 模块、jd-variant。

### 关键边界
- `updateResumeHistoryVersion` 对列 `?? null` 全覆盖；因 `toVersionMutationPayload` 每次都带上两字段，编辑其它元信息不会误清空关联——**实现时须验证** draft 正确 seed（改名后关联仍在）。
- 关联岗位可为空（「不关联」）。
- 岗位被删 → `company_id` 变 null（DB 层 SET NULL），UI 自然显示「未关联」。

### 验证
- `supabase db push` 迁移成功（需用户执行/授权）。
- `tsc --noEmit` + `eslint` 改动文件全绿。
- 纯逻辑（`toVersionMutationPayload`/`normalizeDraft` 含新字段）用一次性 node 脚本验证后删。
- 人工：编辑版本设关联+日期→保存→只读态显示正确；改名不清空关联；删岗位后显示未关联。
- 本仓库默认不写持久化测试。

### 非目标复述
一键派生、新建时设置、岗位侧反向列表 —— 均不在本轮。
