# 简历编辑器 Toolbar 控件更新实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在保留现有粗粒度间距滑块与即时同步行为的基础上，增加精细间距的本地实时预览事务、自托管六字体与字号滑杆，并让历史版本快速保存支持可选版本名。

**架构：** 将 Toolbar 中的间距、字体和快速保存拆为独立组件；在简历配置 Zustand Store 中把正式 `spacing` 与临时 `spacingPreview` 分离，只有确认精细调整时才将完整预览一次性写入正式配置。字体继续通过配置 Schema 统一归一化，由构建产物打包字体文件；历史快速保存 Dialog 复用现有快照、哈希与 Supabase 写入链路。

**技术栈：** React 19、TypeScript 5.9、Zustand 5、Radix/shadcn UI、Tailwind CSS 4、Zod 4、Vite 7、pnpm、Supabase

**规格：** `docs/superpowers/specs/2026-08-13-resume-toolbar-controls-design.md`

---

## 文件结构与职责

### 创建

- `src/pages/resume/editor/components/toolbar/spacing-settings.tsx`
  - 粗/精细模式、字符串草稿、精度校验、预览事务和未保存退出保护。
- `src/pages/resume/editor/components/toolbar/font-settings.tsx`
  - 六字体选择与 `10–24px` 字号滑杆。
- `src/pages/resume/editor/components/toolbar/quick-save-version-dialog.tsx`
  - 可选版本名表单、哈希去重与版本创建。

### 修改

- `src/store/resume/config.ts`
  - 增加 `spacingPreview` 及 begin/update/commit/discard 四个事务动作。
- `src/hooks/use-resume-styles.ts`
  - 无显式 appearance 时使用 `spacingPreview ?? spacing`。
- `src/pages/resume/editor/hooks/use-resume-loader.ts`
  - 切换简历和卸载编辑器时清理预览事务。
- `src/lib/schema/resume/config/font.ts`
  - 扩充六字体枚举、名称、CSS 回退和字重策略，移除字号下拉选项。
- `src/main.tsx`、`src/index.css`
  - 注册随构建分发的 Arimo、IBM Plex Sans SC 和站酷小薇体字体资源。
- `src/pages/resume/editor/components/toolbar/index.tsx`
  - 改为编排间距、字体、主题、历史、血缘与导出入口。
- `src/pages/resume/editor/components/toolbar/history-version-dropdown.tsx`
  - 快速保存菜单项仅负责打开独立 Dialog。
- `package.json`、`pnpm-lock.yaml`
  - 增加三项开源字体依赖。

### 不修改

- 数据库字段、历史版本完整管理页、分享/Tracker 的显式 appearance 快照。
- `AGENTS.md` 和 `src/components/ui/sheet.tsx` 中已有的用户改动。
- 粗粒度滑杆的范围、步长与即时持久化语义。

## 工作区保护

- 继续在当前分支工作，不创建分支或 worktree。
- 不执行 `git push`。
- 只暂存当前任务明确列出的文件；不暂存 `.superpowers/brainstorm/`、`AGENTS.md` 或 `src/components/ui/sheet.tsx`。
- 仓库说明明确当前无测试约定，因此本计划不引入测试框架；每个任务使用定向 ESLint、TypeScript、构建和手动交互检查。
- 每次提交前运行 `git diff --check`，并用 `git diff --cached --name-only` 复核提交边界。

---

### 任务 1：建立正式间距与精细预览的 Store 边界

**文件：**

- 修改：`src/store/resume/config.ts`
- 修改：`src/hooks/use-resume-styles.ts`
- 修改：`src/pages/resume/editor/hooks/use-resume-loader.ts`

- [ ] **步骤 1：扩展配置 Store 类型与初始状态**

在 `ResumeConfigState` 中增加：

```ts
spacingPreview: ResumeAppearanceConfig['spacing'] | null
beginSpacingPreview: () => void
updateSpacingPreview: (data: Partial<ResumeAppearanceConfig['spacing']>) => void
commitSpacingPreview: () => void
discardSpacingPreview: () => void
```

把 `create<ResumeConfigState>()(set => ...)` 改为可读取当前状态的 `create<ResumeConfigState>()((set, get) => ...)`，并将 `spacingPreview` 初始化为 `null`。

- [ ] **步骤 2：实现四个无歧义的预览事务动作**

实现规则：

```ts
beginSpacingPreview: () => {
  set((state) =>
    state.spacingPreview ? {} : { spacingPreview: { ...state.spacing } },
  )
}

updateSpacingPreview: (data) => {
  set((state) =>
    state.spacingPreview
      ? { spacingPreview: { ...state.spacingPreview, ...data } }
      : {},
  )
}

commitSpacingPreview: () => {
  const preview = get().spacingPreview
  if (!preview) return
  const spacing = { ...preview }
  set({ spacing, spacingPreview: null })
  persistResumeAppearance?.({ spacing })
}

discardSpacingPreview: () => set({ spacingPreview: null })
```

`updateSpacingPreview` 不得调用 `persistResumeAppearance`。`replaceConfig` 继续只更新正式值且不得覆盖正在编辑的预览；`resetConfig` 与 `hydrateFromSnapshot` 返回正式配置时同时写入 `spacingPreview: null`。

- [ ] **步骤 3：让编辑器样式优先消费预览值**

在 `useResumeStyles` 订阅 `spacingPreview`，仅当未提供 `appearanceOverride` 时构造：

```ts
spacing: storeSpacingPreview ?? storeSpacingConfig
```

显式 appearance 分支继续 `normalizeResumeAppearance(appearanceOverride)`，保证历史、分享和 Tracker 不受编辑器临时值影响。

- [ ] **步骤 4：清理简历切换和编辑器卸载的临时状态**

在 `useResumeLoader` 的 `activeResumeId` 加载 effect 开始处调用 `discardSpacingPreview()`，覆盖 legacy fallback 使用 `replaceConfig` 的路径；在编辑器清理 effect 中也调用一次，避免离开编辑器后预览跨页面残留。远端协作仍通过 `replaceConfig` 更新正式值，活跃预览保持不变。

- [ ] **步骤 5：运行定向静态检查**

运行：

```bash
pnpm exec eslint src/store/resume/config.ts src/hooks/use-resume-styles.ts src/pages/resume/editor/hooks/use-resume-loader.ts
pnpm exec tsc --noEmit --pretty false
git diff --check
```

预期：三个命令退出码均为 `0`；类型检查确认预览只影响渲染，不进入现有持久化与广播订阅。

- [ ] **步骤 6：提交 Store 边界**

```bash
git add src/store/resume/config.ts src/hooks/use-resume-styles.ts src/pages/resume/editor/hooks/use-resume-loader.ts
git diff --cached --name-only
git commit -m "feat: 添加精细间距预览事务"
```

---

### 任务 2：实现间距粗/精细模式与未保存退出保护

**文件：**

- 创建：`src/pages/resume/editor/components/toolbar/spacing-settings.tsx`
- 修改：`src/pages/resume/editor/components/toolbar/index.tsx`

- [ ] **步骤 1：定义精细字段规格和字符串草稿**

在 `spacing-settings.tsx` 中定义三个字段：

```ts
const FINE_SPACING_FIELDS = [
  {
    key: 'sectionSpacing',
    label: '模块上下间距',
    min: 0,
    max: 100,
    decimals: 1,
    suffix: 'px',
  },
  {
    key: 'lineHeight',
    label: '行间距',
    min: 1,
    max: 3,
    decimals: 2,
    suffix: '倍',
  },
  {
    key: 'pageMargin',
    label: '页面边距',
    min: 0,
    max: 100,
    decimals: 1,
    suffix: 'px',
  },
] as const
```

草稿必须保存字符串而不是直接保存数字；校验函数拒绝空值、非十进制数字、越界值和超过 `decimals` 的小数位，并返回可展示的具体错误。合法输入才调用 `updateSpacingPreview({ [key]: parsed })`，非法输入保留画布的最后有效预览。

- [ ] **步骤 2：保留原样的粗粒度滑杆**

把 `index.tsx` 现有三组 Slider 原样迁移到 `SpacingSettings` 的粗粒度分支：

- 模块上下间距：`0–100`、`step=1`。
- 行间距：内部 Slider `10–30`、`step=1`，写入时除以 `10`。
- 页面边距：`0–100`、`step=1`。

三者继续直接调用 `updateSpacing`，不得经过预览事务或确认按钮。

- [ ] **步骤 3：实现精细模式会话**

组件本地保存 `open`、`fineMode`、`draft`、`baseline` 和待完成退出动作。行为：

1. 首次默认粗粒度；`fineMode` 在组件生命周期内保留。
2. 开关切到精细或以精细模式重新打开时，从最新正式 `spacing` 构造 baseline/draft 并调用 `beginSpacingPreview()`。
3. dirty 以当前草稿的有效数字与 baseline 比较；非法且不同于初始字符串的草稿也算 dirty，用户恢复到 baseline 后 dirty 回到 false。
4. 所有字段合法时启用“确认”；确认 dirty 事务时调用一次 `commitSpacingPreview()`，无变化时只丢弃事务，然后关闭。
5. 未确认关闭、取消或切回粗粒度时只调用 `discardSpacingPreview()`，正式值从未被回写。

- [ ] **步骤 4：覆盖所有未保存退出路径**

使用受控 `DropdownMenu` 与独立 `AlertDialog`：

- `onOpenChange(false)` 覆盖触发器再次点击和常规关闭。
- `DropdownMenuContent` 的 `onInteractOutside` 与 `onEscapeKeyDown` 在 dirty 时 `preventDefault()` 并打开确认对话框。
- “取消”与 Switch 切回粗粒度复用同一 `requestExit('close' | 'coarse')`。
- 对话框使用规格文案“放弃未保存的间距修改？”、“继续编辑”、“放弃修改”。
- “继续编辑”只关闭 AlertDialog 并保留菜单、草稿和预览；“放弃修改”清预览后完成原关闭或模式切换。

依赖 Radix DropdownMenu 的默认 modal 行为阻止底层 Toolbar 操作在外部点击同一事件中执行；手动验证导出和快速保存必须先解决退出保护。

- [ ] **步骤 5：完成精细输入的可访问 UI**

标题栏右侧放置带可读 `Label` 的“精细控制” Switch。精细输入使用 `type="text"`、`inputMode="decimal"`，展示单位后缀、`aria-invalid` 和仅在出错时出现的错误文案。精细分支底部仅显示“取消”“确认”，不得增加用户已要求删除的常驻说明文案。

- [ ] **步骤 6：让 Toolbar 编排新组件**

从 `index.tsx` 删除间距内部实现，改为：

```tsx
<SpacingSettings isMobile={isMobile} disabled={isToolbarLoading} />
```

保留主题、历史、血缘和导出入口的顺序及行为。

- [ ] **步骤 7：运行定向检查并提交**

```bash
pnpm exec eslint src/pages/resume/editor/components/toolbar/spacing-settings.tsx src/pages/resume/editor/components/toolbar/index.tsx
pnpm exec tsc --noEmit --pretty false
git diff --check
git add src/pages/resume/editor/components/toolbar/spacing-settings.tsx src/pages/resume/editor/components/toolbar/index.tsx
git diff --cached --name-only
git commit -m "feat: 添加精细间距控制"
```

---

### 任务 3：引入并注册六款项目自托管开源字体

**文件：**

- 修改：`package.json`
- 修改：`pnpm-lock.yaml`
- 修改：`src/main.tsx`
- 修改：`src/index.css`
- 修改：`src/lib/schema/resume/config/font.ts`

- [ ] **步骤 1：安装锁定版本的字体包**

运行：

```bash
pnpm add @ibm/plex-sans-sc@1.1.0 @fontsource-variable/arimo@5.2.8 @fontsource/zcool-xiaowei@5.2.8
```

这些依赖分别携带 SIL OFL 1.1、Apache 2.0 和 SIL OFL 1.1 许可证；不复制字体到仓库，不增加运行时 CDN 请求。

- [ ] **步骤 2：只注册实际需要的字重资源**

在 `src/main.tsx` 增加：

```ts
import '@fontsource-variable/arimo/wght.css'
```

在 `src/index.css` 增加无 `local()` 的 `@font-face`：

- `IBM Plex Sans SC`：直接引用 package 的 complete WOFF2 Regular、SemiBold、Bold 文件，分别注册 400、600、700。
- `ZCOOL XiaoWei`：引用 `zcool-xiaowei-chinese-simplified-400-normal.woff2`，只注册 400。

保留现有思源黑体、思源宋体和霞鹜文楷注册。构建后检查 `dist/assets`，确认字体由应用产物分发且未打包 IBM 的全部拆分文件。

- [ ] **步骤 3：扩充字体 Schema 且保持旧值兼容**

把字体常量扩充为：

```ts
export const RESUME_FONT_FAMILIES = {
  sans: 'noto-sans-sc',
  ibmPlexSans: 'ibm-plex-sans-sc',
  serif: 'noto-serif-sc',
  wenkai: 'lxgw-wenkai',
  arimo: 'arimo',
  zcoolXiaowei: 'zcool-xiaowei',
} as const
```

`fontFamilyOptions` 按规格顺序显示“思源黑体、IBM Plex Sans SC、思源宋体、霞鹜文楷、Arimo、站酷小薇体”。`fontFamilyEnum` 覆盖六值；`LEGACY_FONT_FAMILY_MAP` 保持现有映射不变。

- [ ] **步骤 4：覆盖字体名称、CSS 回退与有效字重**

实现下列映射：

- 思源黑体：`Noto Sans SC Variable`，400/600/700。
- IBM：`IBM Plex Sans SC`，400/600/700。
- 思源宋体：`Noto Serif SC Variable`，400/600/700。
- 霞鹜文楷：`LXGW WenKai`，500/500/700。
- Arimo：`Arimo Variable`，CSS 为 `'Arimo Variable', 'Noto Sans SC Variable', sans-serif`，400/600/700。
- 站酷小薇体：`ZCOOL XiaoWei`，CSS 回退到 `'Noto Serif SC Variable', serif`，所有层级使用 400。

删除已无消费者的 `fontSizeOptions`。这些名称必须与 `document.fonts.load`、分页等待和打印 iframe 使用的真实注册族名一致。

- [ ] **步骤 5：运行字体定向检查**

```bash
pnpm exec eslint src/main.tsx src/lib/schema/resume/config/font.ts
pnpm exec tsc --noEmit --pretty false
pnpm build
find dist/assets -maxdepth 1 -type f | sort | rg 'woff2|ttf|otf'
git diff --check
```

预期：构建退出码 `0`，字体资源位于 `dist/assets`；源码和构建产物均无 `fonts.googleapis.com`、GitHub CDN 等运行时字体 URL。

- [ ] **步骤 6：提交字体资源与 Schema**

```bash
git add package.json pnpm-lock.yaml src/main.tsx src/index.css src/lib/schema/resume/config/font.ts
git diff --cached --name-only
git commit -m "feat: 扩充项目自托管简历字体"
```

---

### 任务 4：拆分字体设置并将字号改为即时滑杆

**文件：**

- 创建：`src/pages/resume/editor/components/toolbar/font-settings.tsx`
- 修改：`src/pages/resume/editor/components/toolbar/index.tsx`

- [ ] **步骤 1：迁移字体选择**

在 `FontSettings` 中复用 `fontFamilyOptions` 和当前 Select 结构，选择时继续调用：

```ts
updateFont({ fontFamily: value })
```

不增加确认态；六个选项必须展示真实字体名称。

- [ ] **步骤 2：用 Slider 替换字号 Select**

实现标题行右侧 `{font.fontSize}px` 和：

```tsx
<Slider
  aria-label='文字大小'
  value={[font.fontSize]}
  min={10}
  max={24}
  step={1}
  onValueChange={([fontSize]) => updateFont({ fontSize })}
/>
```

拖动继续走现有正式 `updateFont` 链路；界面不得显示范围、步长或实时应用的常驻提示。

- [ ] **步骤 3：精简 Toolbar 编排**

从 `index.tsx` 删除字体内部实现及无用 import，改为：

```tsx
<FontSettings isMobile={isMobile} disabled={isToolbarLoading} />
```

- [ ] **步骤 4：运行定向检查并提交**

```bash
pnpm exec eslint src/pages/resume/editor/components/toolbar/font-settings.tsx src/pages/resume/editor/components/toolbar/index.tsx
pnpm exec tsc --noEmit --pretty false
git diff --check
git add src/pages/resume/editor/components/toolbar/font-settings.tsx src/pages/resume/editor/components/toolbar/index.tsx
git diff --cached --name-only
git commit -m "feat: 更新字体与字号控制"
```

---

### 任务 5：为历史版本快速保存增加可选命名 Dialog

**文件：**

- 创建：`src/pages/resume/editor/components/toolbar/quick-save-version-dialog.tsx`
- 修改：`src/pages/resume/editor/components/toolbar/history-version-dropdown.tsx`

- [ ] **步骤 1：让历史菜单只管理入口**

`ResumeHistoryVersionDropdown` 保留 history 可用性和跳转判断，增加 `quickSaveOpen`；“快速保存”使用 `onSelect` 关闭 DropdownMenu 后打开 Dialog，不再在菜单项内直接执行网络请求。

- [ ] **步骤 2：创建受控快速保存 Dialog**

`QuickSaveVersionDialog` 接收 `open`、`onOpenChange` 和已校验的 `resumeId`，内部保存 `versionName` 与 `saving`。Dialog 使用 `<form onSubmit>`，输入设置：

```tsx
maxLength={60}
placeholder="例如：项目优化版、字节投递版"
autoFocus
```

标题、说明、Label 和按钮严格使用规格文案。保存中 `onOpenChange(false)` 不生效，关闭按钮隐藏或禁用，取消和保存按钮均防止重复操作。

- [ ] **步骤 3：迁移现有保存流程并写入版本名**

提交时：

1. `const normalizedVersionName = versionName.trim()`。
2. 调用 `getResumeHistoryResume`、`buildResumeSnapshot`、`createResumeSnapshotHash`。
3. 调用 `listResumeHistoryVersions` 保留最新哈希去重。
4. 创建记录时传 `version_name: normalizedVersionName || null`。
5. 创建成功后 Toast、清空输入并关闭；失败保留输入和 Dialog。
6. 内容重复时 Toast 且不创建记录；该操作已完成，清空输入并关闭 Dialog。

Enter 由 form submit 自然触发。保存成功/重复关闭与失败保持打开的分支必须在 `finally` 中正确恢复 `saving`。

- [ ] **步骤 4：运行定向检查并提交**

```bash
pnpm exec eslint src/pages/resume/editor/components/toolbar/history-version-dropdown.tsx src/pages/resume/editor/components/toolbar/quick-save-version-dialog.tsx
pnpm exec tsc --noEmit --pretty false
git diff --check
git add src/pages/resume/editor/components/toolbar/history-version-dropdown.tsx src/pages/resume/editor/components/toolbar/quick-save-version-dialog.tsx
git diff --cached --name-only
git commit -m "feat: 支持命名快速保存版本"
```

---

### 任务 6：集成验证与回归检查

**文件：**

- 检查：本计划所有改动文件
- 不新增自动化测试文件

- [ ] **步骤 1：检查规格覆盖和残留实现**

```bash
rg -n "fontSizeOptions|无衬线|衬线|文楷" src/pages/resume/editor/components/toolbar src/lib/schema/resume/config/font.ts
rg -n "实时预览|确认后同步|范围保持|步长为 1|立即应用" src/pages/resume/editor/components/toolbar
rg -n "spacingPreview|beginSpacingPreview|commitSpacingPreview|discardSpacingPreview" src
rg -n "fonts.googleapis.com|fonts.gstatic.com|raw.githubusercontent.com" src package.json
```

预期：旧字号下拉和已删除说明文案无命中；预览事务只进入 Store、样式 Hook、loader 与间距组件；没有外部字体 URL。

- [ ] **步骤 2：运行完整静态验证**

```bash
pnpm exec eslint src/store/resume/config.ts src/hooks/use-resume-styles.ts src/pages/resume/editor/hooks/use-resume-loader.ts src/lib/schema/resume/config/font.ts src/main.tsx src/pages/resume/editor/components/toolbar/index.tsx src/pages/resume/editor/components/toolbar/spacing-settings.tsx src/pages/resume/editor/components/toolbar/font-settings.tsx src/pages/resume/editor/components/toolbar/history-version-dropdown.tsx src/pages/resume/editor/components/toolbar/quick-save-version-dialog.tsx
pnpm exec tsc --noEmit --pretty false
pnpm build
git diff --check
```

记录每个命令的真实退出码；不得把静态通过描述成浏览器交互已验证。

- [ ] **步骤 3：在本地编辑器完成桌面手动矩阵**

使用现有开发服务器或运行 `pnpm dev`，在一份在线简历中检查：

- 粗粒度三滑杆保持原 UI、范围、步长和即时同步。
- 切到精细后，`16.1 / 1.61 / 50.1` 等合法值立即改变画布分页；空值、越界和超精度不覆盖最后有效画布且确认禁用。
- 精细输入过程中正式 Store `spacing` 不变；确认后完整值只提交一次；放弃后恢复正式值。
- 外部点击、Escape、触发器、取消、切回粗粒度均触发或绕过提示的正确分支。
- 精细 dirty 时点击字体、历史或导出，不会执行下层操作，必须先继续编辑或放弃。
- 六字体逐项实际改变页面；Arimo 中文回退为项目思源黑体；站酷小薇体不请求系统/外部字体。
- 字号 10、14、24 即时改变页面，Slider 只能产生整数。
- 快速保存空名写入 `null`，非空名去除首尾空格，失败保留输入，重复内容不创建新版本。

- [ ] **步骤 4：完成移动端关键路径检查**

在浏览器响应式移动尺寸检查间距菜单宽度、Switch、数值键盘提示、退出保护、字体 Slider 和快速保存 Dialog，确认没有横向溢出或被遮挡控件。

- [ ] **步骤 5：复核提交与工作区边界**

```bash
git status --short
git log --oneline -6
git diff --stat HEAD~5..HEAD
```

确认 `.superpowers/brainstorm/`、`AGENTS.md`、`src/components/ui/sheet.tsx` 未进入任何本任务提交；不推送远端。

---

## 完成定义

- 间距、字体、历史快速保存三项产品需求全部满足批准规格。
- 精细间距草稿仅影响当前编辑器渲染，确认前不进入正式配置、协作广播、历史/分享或 Word 导出。
- 六款字体均由应用构建产物提供；字号 Slider 为 `10–24`、`step=1`。
- 快速保存名称可空、最长 60 字符、正确 trim，哈希去重不被名称绕过。
- 所有定向 ESLint、TypeScript 和生产构建使用本轮真实输出验证通过。
- 手动桌面/移动矩阵的实际已验证项与仅静态确认项在最终交付中明确区分。
