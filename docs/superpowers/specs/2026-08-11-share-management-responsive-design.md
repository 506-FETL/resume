# 分享管理响应式改版 · 设计规格

- 日期：2026-08-11
- 状态：已批准，待实现计划
- 关联规格：`docs/superpowers/specs/2026-08-11-resume-share-link-design.md`

## 1. 背景

首版简历分享功能已具备快照、密码、有效期、访问统计、撤销和匿名预览能力，但当前暴露出四类问题：

1. 分享弹窗和链接内容存在横向溢出，64 位 token 会撑宽容器。
2. 创建与编辑有效期仍使用浏览器原生 `input[type=date]`，与项目 UI 不一致。
3. 设置访问密码时 Edge Function 返回 `{"error":"unexpected"}`。
4. 只能在单份简历内管理链接，缺少跨简历统一管理入口。

同时，匿名预览页当前位于 `src/pages/resume/view/`，不符合“业务代码靠近业务”的页面组织原则。

## 2. 已确认决策

| 决策点 | 结论 |
|---|---|
| 统一管理入口 | 侧边栏新增独立「分享管理」 |
| 管理页路由 | `/share` |
| 匿名预览路由 | `/share/view/:token` |
| 旧路由 | 删除 `/resume/view/:token`，不做重定向（功能尚未上线） |
| 桌面布局 | `lg` 3 列紧凑卡片，`2xl` 4 列 |
| 平板布局 | 单列或 2 列自适应紧凑卡片 |
| 移动布局 | 紧凑列表，次要操作进入底部 Drawer |
| 日期选择 | 全部复用项目 `Calendar + Popover` |
| 密码算法 | Edge Runtime 原生 Web Crypto PBKDF2-SHA256 |

## 3. 页面模块结构

遵循 `src/pages/history` 的 history-style 模块结构：

```text
src/pages/share/
├── components/
│   ├── share-header/
│   │   └── index.tsx
│   ├── share-toolbar/
│   │   └── index.tsx
│   ├── share-grid/
│   │   └── index.tsx
│   ├── share-card/
│   │   └── index.tsx
│   ├── share-mobile-list/
│   │   └── index.tsx
│   ├── share-mobile-item/
│   │   └── index.tsx
│   ├── share-action-drawer/
│   │   └── index.tsx
│   ├── share-dialog/
│   │   ├── index.tsx
│   │   ├── create-share-form.tsx
│   │   ├── share-link-row.tsx
│   │   ├── share-settings-dialog.tsx
│   │   └── share-date-field.tsx
│   ├── share-empty-state/
│   │   └── index.tsx
│   └── share-pdf-export/
│       └── index.tsx
├── hooks/
│   └── use-share-page-bootstrap.ts
├── view/
│   └── [token].tsx
├── const.ts
├── index.tsx
├── store.ts
├── types.ts
└── utils.ts
```

调整原则：

- 现有 `src/components/resume-share/` 迁入 `src/pages/share/components/share-dialog/`。
- 现有 `src/pages/resume/view/` 迁入 `src/pages/share/view/`。
- 现有全局 `src/store/resume-share/` 收敛到 `src/pages/share/store.ts`。
- Supabase 数据访问仍保留在 `src/lib/supabase/resume/share.ts`，因为它属于跨页面基础设施。

## 4. 统一管理页

### 4.1 页面目标

统一管理当前用户全部云端简历的分享链接：

- 搜索链接名称、简历名称或 token。
- 按简历筛选。
- 按全部 / 有效 / 已关闭 / 已过期筛选。
- 预览、复制、编辑设置、推送最新版、启停、删除。
- 展示成功打开次数与最后查看时间。

简历筛选为可搜索多选：

- 支持同时筛选多份简历。
- 触发器展示单个名称或“已选 N 项”。
- 支持一键清空。

### 4.2 桌面卡片

桌面端不使用大面积详情卡，采用紧凑卡片：

- `lg:grid-cols-3`
- `2xl:grid-cols-4`
- 单卡目标高度约 `140–160px`
- 卡片仅展示：
  - 链接图标
  - 链接名称
  - 所属简历
  - 状态点
  - 截断链接
  - 密码 / 打开次数 / 最后查看或有效期
  - 预览 / 设置 / 更多图标按钮

颜色语义：

| 状态 | 颜色 |
|---|---|
| 有效 | 绿色 |
| 已关闭 | 灰色 |
| 已过期 | 红色 |
| 密码保护 | 琥珀色 |
| 预览操作 | 蓝色 |

### 4.3 移动端列表

移动端复用 Tracker 的 card/list 响应式思想：

- 单列紧凑列表。
- 链接单行截断。
- 整张卡片可点击打开操作 Drawer。
- 只保留复制按钮，不展示右上角更多按钮。
- 预览、设置、推送、删除进入底部 Drawer。
- 不产生横向滚动。
- 打开 Drawer 前释放背景焦点，避免 Radix / Vaul 将仍持有焦点的背景节点设置为 `aria-hidden`。

## 5. 分享弹窗布局修复

现有 Dialog 在窄屏和中等宽度下会被三列表单与长链接撑宽。

调整：

- `DialogContent` 必须包含 `min-w-0` 与受控最大宽度。
- 所有网格子项必须包含 `min-w-0`。
- 创建表单：
  - 移动端单列。
  - 桌面端两列。
  - 名称与密码同一行，有效期独占一行。
- 链接列表容器和链接文本必须 `min-w-0`。
- 卡片操作允许换行，不允许撑宽 Dialog。

## 6. 长 URL 展示

任何 UI 都不能直接展示完整 64 位 token。

显示格式：

```text
localhost:5173/share/view/022bd124…f45cc0d
```

实现规则：

- `utils.ts` 提供 `formatShareUrlForDisplay(url)`。
- 保留域名与 `/share/view/`。
- token 显示前 8 位 + `…` + 后 7 位。
- UI 使用 `truncate`，容器必须 `min-w-0`。
- Tooltip 展示完整 URL。
- 复制按钮始终复制完整 URL。

### 验收标准

- 320px、375px、768px、1024px、1440px 宽度均无横向滚动。
- Dialog 不因 URL 变宽。
- 卡片和列表中的复制结果仍是完整 URL。

## 7. 统一日期组件

新增 `ShareDateField`，复用项目现有组件：

- `Calendar`
- `Popover`
- `PopoverContent`
- `PopoverTrigger`
- `CalendarIcon`
- 清除按钮
- `captionLayout="dropdown"`

用于：

1. 创建分享链接的有效期。
2. 编辑分享设置的有效期。

语义：

- 空值表示长期有效。
- 所选日期按用户本地时区当天 `23:59:59.999` 转 ISO。
- 编辑时按本地时区回填日期。

## 7.1 创建分享

`/share` 管理页使用单一“新建分享”对话框：

- 可搜索 Combobox 选择云端简历。
- 同一对话框内填写名称、密码和有效期。
- 不复用包含历史链接列表的快速分享 Dialog。

## 8. 密码错误修复

### 8.1 根因

已确认：

- 线上 `resume-share v3` 与本地代码一致。
- 请求 body 与字段名正确。
- 数据库已存在 `resume_shares` 与限流表。
- 错误发生在 Edge Function `update_settings` 服务端处理阶段。

现有 `deno.land/x/bcrypt@v0.4.1` 依赖 Worker / WASM，在 Supabase Edge Runtime 中存在运行失败风险；异常被统一泛化为 `unexpected`。

### 8.2 新密码格式

改为仅依赖 Web Crypto 的 PBKDF2-SHA256：

```text
pbkdf2-sha256$<iterations>$<salt-base64url>$<digest-base64url>
```

要求：

- 每个密码使用 `crypto.getRandomValues()` 生成独立 salt。
- PBKDF2-SHA256。
- 固定摘要长度 32 bytes。
- 迭代次数作为 hash 格式的一部分保存。
- 校验使用常量时间字节比较。
- 密码最长 128 字符。
- 保留当前持久化限流。

现有数据：

- 当前功能尚未上线。
- 可直接用新格式覆盖已有测试链接密码。
- 不需要兼容旧 bcrypt hash。

### 8.3 错误可观测性

客户端仍只接收稳定错误码：

- `unauthorized`
- `not_found`
- `password_too_long`
- `invalid_expiry`
- `rate_limited`
- `unexpected`

Function 日志必须记录具体阶段：

- `hash_password_failed`
- `update_settings_failed`
- `verify_password_failed`
- `rate_limit_failed`

日志不记录明文密码、hash 或完整 token。

### 8.4 密码设置界面

- owner 可以直接覆盖新密码，不要求验证旧密码。
- 数据库只保存不可逆 hash，不返回旧密码明文。
- “当前密码”字段只显示 `••••••••` 或“已设置（不可恢复明文）”状态。
- 新密码输入框提供眼睛按钮，可显示 / 隐藏当前输入内容。
- 留空表示保持当前密码；关闭密码开关表示清除密码。

### 验收标准

- 无密码 → 开启密码成功。
- 有密码 → 修改密码成功。
- 有密码 → 关闭密码成功。
- 正确密码可打开分享页。
- 错误密码显示错误。
- 超出限流显示“尝试过于频繁”。
- 网络请求不再返回 `{"error":"unexpected"}`。

## 9. 导航与路由

侧边栏新增：

```text
分享管理 → /share
```

图标使用 `Share2` 或 `Link2`。

`App.tsx` 裸壳判断改为：

```text
/share/view/*
```

删除：

```text
src/pages/resume/view/
```

不保留旧路由、不重定向。

## 10. 数据流

### 管理页

```text
进入 /share
→ 加载当前用户所有分享链接
→ 加载简历摘要映射
→ 页面 store 派生筛选结果
→ 桌面卡片 / 移动列表消费同一数据
```

### 快速分享弹窗

```text
编辑器或简历卡片
→ 打开当前简历 ShareDialog
→ 创建 / 复制 / 轻量设置
→ 与 /share 复用同一数据访问层和页面 store actions
```

### 匿名预览

```text
/share/view/:token
→ resume-share Edge Function
→ 状态 / 有效期 / 限流 / 密码校验
→ 返回脱敏 snapshot + template manifest
→ 只读渲染 / PDF
```

## 11. 非目标

- 不提供旧 `/resume/view/:token` 兼容。
- 不做访问者身份识别或独立访客统计。
- 不做分享链接批量操作。
- 不做图表分析。
- 不增加新的测试框架或测试文件。

## 12. 验证

- `pnpm exec tsc --noEmit`
- 目标 ESLint
- `pnpm build`
- `git diff --check`
- `supabase db push --dry-run --linked`
- `supabase functions deploy resume-share --no-verify-jwt`
- 真实端到端：
  - 创建无密码链接
  - 创建有密码链接
  - 修改 / 清除密码
  - 日期选择与清除
  - 320 / 375 / 768 / 1024 / 1440 视口
  - `/share` 管理
  - `/share/view/:token` 匿名预览

