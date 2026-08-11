# 分享管理响应式改版 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将分享功能重组为独立 `/share` 业务模块，提供响应式统一管理页，并修复长 URL 溢出、原生日期控件和 Edge Function 密码设置失败。

**架构：** 页面代码迁入 history-style `src/pages/share/`；`/share` 管理全部链接，`/share/view/:token` 提供匿名预览。桌面使用 3–4 列紧凑卡片，移动端使用列表 + Drawer。密码哈希改为 Web Crypto PBKDF2-SHA256，保留数据库持久化限流。

**技术栈：** React 19 · TypeScript · Zustand · Supabase · Web Crypto · shadcn/ui · Radix · Tailwind CSS 4 · motion/react

**执行约定：** 当前在 `main` 工作区，用户已授权直接工作；代码保持未提交、未推送。仓库默认不新增测试文件，使用 `tsc`、目标 ESLint、`build`、Supabase dry-run 与真实 Edge Function 验证。

---

## 文件结构

**创建：**

- `src/pages/share/index.tsx` — 统一管理页入口
- `src/pages/share/store.ts` — 页面级状态、链接 CRUD、筛选与对话框状态
- `src/pages/share/types.ts` — 页面筛选、视图模型与状态类型
- `src/pages/share/const.ts` — 状态元数据与响应式常量
- `src/pages/share/utils.ts` — URL 格式化、筛选和日期转换
- `src/pages/share/hooks/use-share-page-bootstrap.ts` — 页面加载全部链接与简历摘要
- `src/pages/share/components/share-header/index.tsx`
- `src/pages/share/components/share-toolbar/index.tsx`
- `src/pages/share/components/share-grid/index.tsx`
- `src/pages/share/components/share-card/index.tsx`
- `src/pages/share/components/share-mobile-list/index.tsx`
- `src/pages/share/components/share-mobile-item/index.tsx`
- `src/pages/share/components/share-action-drawer/index.tsx`
- `src/pages/share/components/share-dialog/index.tsx`
- `src/pages/share/components/share-dialog/create-share-form.tsx`
- `src/pages/share/components/share-dialog/share-link-row.tsx`
- `src/pages/share/components/share-dialog/share-settings-dialog.tsx`
- `src/pages/share/components/share-dialog/share-date-field.tsx`
- `src/pages/share/components/share-empty-state/index.tsx`
- `src/pages/share/components/share-pdf-export/index.tsx`
- `src/pages/share/view/[token].tsx`

**删除：**

- `src/components/resume-share/`
- `src/store/resume-share/`
- `src/pages/resume/view/`

**修改：**

- `src/lib/supabase/resume/share.ts`
- `src/lib/supabase/resume/share.types.ts`
- `supabase/functions/resume-share/index.ts`
- `src/components/dashboard/const.ts`
- `src/App.tsx`
- `src/pages/resume/components/resume-card/index.tsx`
- `src/pages/resume/index.tsx`
- `src/pages/resume/editor/index.tsx`
- `src/pages/resume/editor/components/collaboration/collaboration-controls/index.tsx`
- `README.md`
- `docs/superpowers/specs/2026-08-11-resume-share-link-design.md`

---

## 任务 1：迁移分享页面模块

**文件：**

- 创建：`src/pages/share/`
- 删除：`src/components/resume-share/`
- 删除：`src/store/resume-share/`
- 删除：`src/pages/resume/view/`

- [ ] **步骤 1：按 history-style 创建目录**

所有页面组件必须使用文件夹 + `index.tsx`，不允许在 `components/` 下留下松散组件文件。

- [ ] **步骤 2：迁移页面 store**

将 `src/store/resume-share/{types,store,index}.ts` 合并为：

```text
src/pages/share/store.ts
src/pages/share/types.ts
```

页面内统一：

```ts
import useShareStore from '@/pages/share/store'
```

- [ ] **步骤 3：迁移快速分享 Dialog**

移动到：

```text
src/pages/share/components/share-dialog/
```

组件入口使用默认导出，页面外调用只引用目录：

```ts
import ShareDialog from '@/pages/share/components/share-dialog'
```

- [ ] **步骤 4：迁移预览页**

移动：

```text
src/pages/resume/view/[token].tsx
→ src/pages/share/view/[token].tsx
```

移动 PDF：

```text
src/pages/resume/view/components/share-pdf-export.tsx
→ src/pages/share/components/share-pdf-export/index.tsx
```

不保留旧页面文件。

- [ ] **步骤 5：修正所有 import**

运行：

```bash
rg "resume-share|resume/view|components/resume-share|store/resume-share" src
```

预期：除数据库模块命名外，不存在旧页面路径引用。

- [ ] **步骤 6：验证**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/pages/share src/pages/resume src/App.tsx --no-warn-ignored
```

---

## 任务 2：更新路由与导航

**文件：**

- 修改：`src/components/dashboard/const.ts`
- 修改：`src/App.tsx`

- [ ] **步骤 1：新增侧边栏入口**

在 `Data.modules` 的「我的简历」之后新增：

```ts
{
  title: '分享管理',
  url: '/share',
  icon: Share2,
}
```

- [ ] **步骤 2：更新裸壳判断**

将：

```ts
location.pathname.startsWith('/resume/view/')
```

改为：

```ts
location.pathname.startsWith('/share/view/')
```

- [ ] **步骤 3：验证生成路由**

启动 Vite 后读取 `~react-pages`，确认：

```text
/share
/share/view/:token
```

并确认不存在 `/resume/view/:token`。

---

## 任务 3：长 URL 与 Dialog 响应式修复

**文件：**

- 创建：`src/pages/share/utils.ts`
- 修改：`src/pages/share/components/share-dialog/index.tsx`
- 修改：`src/pages/share/components/share-dialog/create-share-form.tsx`
- 修改：`src/pages/share/components/share-dialog/share-link-row.tsx`

- [ ] **步骤 1：实现 URL 工具**

`utils.ts`：

```ts
export function buildShareUrl(token: string) {
  return `${window.location.origin}/share/view/${token}`
}

export function formatShareUrlForDisplay(url: string) {
  const parsed = new URL(url)
  const token = parsed.pathname.split('/').at(-1) ?? ''
  const shortToken = token.length > 18
    ? `${token.slice(0, 8)}…${token.slice(-7)}`
    : token
  return `${parsed.host}/share/view/${shortToken}`
}
```

- [ ] **步骤 2：修正 Dialog 宽度链**

`DialogContent`：

```text
w-[calc(100%-2rem)]
max-w-2xl
min-w-0
overflow-x-hidden
```

Dialog 内所有 grid / flex 主容器和子项使用 `min-w-0`。

- [ ] **步骤 3：改造创建表单**

布局：

```text
grid-cols-1
sm:grid-cols-2
```

名称和密码占一行，有效期容器 `sm:col-span-2`。

- [ ] **步骤 4：截断链接**

链接行：

```text
grid grid-cols-[minmax(0,1fr)_auto]
```

展示文本使用 `formatShareUrlForDisplay` + `truncate`。

Tooltip 展示完整 URL；复制完整 URL。

- [ ] **步骤 5：视口验证**

检查 320 / 375 / 768 / 1024 宽度：

- Dialog 无横向滚动。
- URL 不撑宽。
- 操作按钮允许换行。

---

## 任务 4：统一日期选择组件

**文件：**

- 创建：`src/pages/share/components/share-dialog/share-date-field.tsx`
- 修改：`create-share-form.tsx`
- 修改：`share-settings-dialog.tsx`
- 修改：`src/pages/share/utils.ts`

- [ ] **步骤 1：日期转换工具**

```ts
export function dateToExpiryIso(date: Date | undefined) {
  if (!date)
    return null
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next.toISOString()
}

export function expiryIsoToDate(value: string | null) {
  return value ? new Date(value) : undefined
}
```

- [ ] **步骤 2：创建 ShareDateField**

复用：

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">
      <CalendarIcon />
      {value ? dayjs(value).format('YYYY-MM-DD') : '长期有效'}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0" align="start">
    <Calendar
      mode="single"
      captionLayout="dropdown"
      selected={value}
      onSelect={onChange}
      disabled={date => date < startOfToday}
    />
  </PopoverContent>
</Popover>
```

提供清除按钮。

- [ ] **步骤 3：替换全部原生日期输入**

运行：

```bash
rg 'type="date"' src/pages/share
```

预期：0 处。

---

## 任务 5：PBKDF2 密码修复

**文件：**

- 修改：`supabase/functions/resume-share/index.ts`

- [ ] **步骤 1：移除 bcrypt**

删除：

```ts
import { compare, hash } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
```

- [ ] **步骤 2：实现 base64url**

```ts
function bytesToBase64Url(bytes: Uint8Array) { ... }
function base64UrlToBytes(value: string) { ... }
```

- [ ] **步骤 3：实现 PBKDF2**

常量：

```ts
const PASSWORD_ALGORITHM = 'pbkdf2-sha256'
const PASSWORD_ITERATIONS = 310_000
const PASSWORD_KEY_LENGTH = 32
const PASSWORD_SALT_LENGTH = 16
```

函数：

```ts
async function hashPassword(password: string): Promise<string>
async function verifyPassword(password: string, storedHash: string): Promise<boolean>
function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean
```

格式：

```text
pbkdf2-sha256$310000$<salt>$<digest>
```

- [ ] **步骤 4：替换写入点**

`set_password` 与 `update_settings` 均使用：

```ts
await hashPassword(password)
```

- [ ] **步骤 5：替换校验点**

匿名访问使用：

```ts
await verifyPassword(password, data.password_hash)
```

- [ ] **步骤 6：阶段化日志**

所有 catch / error 分支记录阶段，但不记录密码、hash、完整 token：

```ts
console.error('update_settings_failed', { shareId, message })
console.error('verify_password_failed', { shareId: data.id, message })
```

- [ ] **步骤 7：部署并真实验证**

```bash
supabase functions deploy resume-share --no-verify-jwt
supabase functions list --project-ref "$(cat supabase/.temp/project-ref)"
```

真实操作：

1. 无密码链接开启密码。
2. 修改密码。
3. 清除密码。
4. 正确 / 错误密码访问。

预期：不再返回 `{"error":"unexpected"}`。

---

## 任务 6：数据层支持统一管理

**文件：**

- 修改：`src/lib/supabase/resume/share.ts`
- 修改：`src/lib/supabase/resume/share.types.ts`
- 修改：`src/pages/share/store.ts`
- 修改：`src/pages/share/types.ts`

- [ ] **步骤 1：增加全部链接查询**

```ts
export async function listAllResumeShares(): Promise<ResumeShareRecord[]> {
  const user = await getCurrentUser()
  if (!user)
    throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('resume_shares')
    .select(SHARE_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error)
    throw error
  return (data ?? []).map(toRecord)
}
```

- [ ] **步骤 2：增加简历摘要**

复用 `getAllResumesFromUser()`，映射：

```ts
Record<resumeId, {
  displayName: string
  type: ResumeType
}>
```

- [ ] **步骤 3：页面 store**

状态：

```ts
shares
resumeMap
loading
error
searchKeyword
resumeFilter
statusFilter
actionShare
createDialogOpen
```

actions：

```ts
bootstrap
reload
setSearchKeyword
setResumeFilter
setStatusFilter
openActionDrawer
closeActionDrawer
```

CRUD 成功后同时更新管理页列表和当前简历 Dialog 列表。

- [ ] **步骤 4：纯函数筛选**

`utils.ts`：

```ts
deriveShareStatus(share)
filterShares(shares, filters, resumeMap)
```

状态优先级：

```text
expired > inactive > active
```

---

## 任务 7：实现响应式统一管理页

**文件：**

- 创建：`src/pages/share/index.tsx`
- 创建：`share-header`
- 创建：`share-toolbar`
- 创建：`share-grid`
- 创建：`share-card`
- 创建：`share-mobile-list`
- 创建：`share-mobile-item`
- 创建：`share-action-drawer`
- 创建：`share-empty-state`

- [ ] **步骤 1：页面入口**

```tsx
<div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-8">
  <ShareHeader />
  <ShareToolbar />
  <ShareGrid />
  <ShareMobileList />
  <ShareActionDrawer />
</div>
```

- [ ] **步骤 2：桌面卡片网格**

```text
hidden lg:grid
lg:grid-cols-3
2xl:grid-cols-4
gap-3
```

单卡紧凑，不设置大面积统计块。

卡片包含：

- `Link2` 彩色图标容器
- 链接名
- 所属简历
- 8px 状态点
- 短 URL + Copy
- `LockKeyhole` / `Eye` / `Clock3`
- 预览 / 设置 / 更多图标按钮

状态色：

```text
active: emerald
inactive: slate
expired: red
password: amber
preview: blue
```

- [ ] **步骤 3：移动列表**

```text
grid lg:hidden
```

每项只展示：

- 图标
- 名称
- 状态点
- 所属简历
- 密码 / 打开数 / 有效期摘要
- 短链接
- 复制和更多

- [ ] **步骤 4：底部 Drawer**

操作：

- 预览
- 编辑设置
- 推送最新版
- 启停
- 永久删除

- [ ] **步骤 5：动效**

使用 `motion/react`：

- 页面卡片轻量 stagger。
- Drawer 与 Dialog 使用现有 Radix / Vaul 动效。
- 尊重 reduced motion。

---

## 任务 8：接线快速分享入口

**文件：**

- 修改：`src/pages/resume/components/resume-card/index.tsx`
- 修改：`src/pages/resume/index.tsx`
- 修改：`src/pages/resume/editor/index.tsx`
- 修改：`src/pages/resume/editor/components/collaboration/collaboration-controls/index.tsx`

- [ ] **步骤 1：更新 import**

全部改用：

```ts
@/pages/share/store
@/pages/share/components/share-dialog
```

- [ ] **步骤 2：维持快速入口职责**

编辑器与简历卡片只做：

- 打开当前简历分享 Dialog。
- 创建链接。
- 复制链接。
- 轻量设置。

统一管理入口由侧边栏 `/share` 承担。

- [ ] **步骤 3：增加“查看全部分享”**

快速 Dialog 底部新增：

```text
前往分享管理 →
```

导航 `/share`。

---

## 任务 9：文档与最终验证

**文件：**

- 修改：`README.md`
- 修改：`docs/superpowers/specs/2026-08-11-resume-share-link-design.md`

- [ ] **步骤 1：更新路由与页面说明**

统一为：

```text
/share
/share/view/:token
```

删除所有 `/resume/view/:token` 文案。

- [ ] **步骤 2：更新密码算法说明**

移除 bcrypt，记录 PBKDF2-SHA256 与限流。

- [ ] **步骤 3：静态验证**

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/pages/share src/pages/resume src/lib/supabase/resume/share.ts src/App.tsx src/components/dashboard/const.ts --no-warn-ignored
pnpm build
git diff --check
```

- [ ] **步骤 4：路由验证**

确认生成：

```text
/share
/share/view/:token
```

确认未生成：

```text
/resume/view/:token
```

- [ ] **步骤 5：数据库与函数**

```bash
supabase db push --dry-run --linked
supabase functions deploy resume-share --no-verify-jwt
```

- [ ] **步骤 6：视觉验证**

视口：

```text
320 × 800
375 × 812
768 × 1024
1024 × 768
1440 × 900
1728 × 1117
```

检查：

- 无横向滚动。
- Dialog 不被 URL 撑宽。
- 桌面 3–4 列紧凑卡片。
- 移动列表 + Drawer。
- Calendar 不使用原生 UI。
- 所有操作有图标和语义色。

- [ ] **步骤 7：端到端密码验证**

真实操作并检查 Network：

1. 设置密码，响应 200。
2. 正确密码预览成功。
3. 错误密码提示正确。
4. 清除密码后无需密码。
5. 不出现 `{"error":"unexpected"}`。

---

## 自检结果

- 四个原始问题均有明确任务覆盖：
  - URL 溢出：任务 3。
  - 原生日期：任务 4。
  - 密码 unexpected：任务 5。
  - 统一管理：任务 6–8。
- 页面目录满足 history-style。
- `/resume/view/:token` 明确删除，不做重定向。
- 桌面卡片尺寸、移动列表、图标和颜色均有可验证标准。
- 无 TODO、无待定字段、无未定义接口。

