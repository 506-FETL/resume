# 富文本协作光标原子 Widget 修复实施计划

> **给代理执行者：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐步实现本计划。步骤使用复选框（`- [ ]`）语法跟踪，执行时必须把本文件同步更新为最新状态。

**目标：** 将远端协作光标改为合法、零净宽且边界明确的原子行内 widget，消除协作者侧昵称气泡堆叠和移动残片，并保留现有 Yjs awareness 与身份去重行为。

**架构：** 先做不改变行为的 DOM 构造器提取，再用 DOM 语义测试和编译后 SCSS 契约测试分别驱动标签与几何修改。最后用真实 Tiptap/Yjs 双编辑器及多字段共享 awareness 集成测试锁定节点生命周期；像素残影仍以双账号浏览器回归作为完成门槛。

**技术栈：** TypeScript、Tiptap 3、ProseMirror、Yjs、y-protocols、SCSS、sass-embedded、happy-dom、Node.js 内置测试运行器、pnpm。

**设计规格：** `docs/superpowers/specs/2026-07-26-collaboration-caret-widget-boundary-design.md`

**执行约束：** 使用 @superpowers:test-driven-development 严格执行红灯—绿灯—重构；使用 @superpowers:verification-before-completion 做最终验证。保持当前分支，不创建或切换分支；没有用户明确指令时不得 `git push`。保留现有 `.DS_Store` 工作区改动，不暂存、不提交、不删除。

---

## 文件职责

- 新建 `src/lib/collaboration/richtext/caret-dom.ts`：只构造远端 caret/label DOM，不依赖 Yjs 或应用别名。
- 修改 `src/lib/collaboration/richtext/collab-extensions.ts`：删除内联 DOM 构造，导入并传递 `createCollaborationCaret`；其余扩展组装与去重逻辑不变。
- 新建 `src/lib/collaboration/richtext/caret-dom.test.ts`：验证合法的 `SPAN > SPAN` 结构、样式数据和空姓名回退。
- 新建 `src/lib/collaboration/richtext/caret-style.test.ts`：编译并精确提取 caret 选择器，验证原子盒几何契约。
- 修改 `src/components/tiptap-node/paragraph-node/paragraph-node.scss`：定义零净宽、1em 高、`text-bottom` 对齐的 inline-block caret。
- 新建 `src/lib/collaboration/richtext/caret-lifecycle.integration.test.ts`：真实验证双编辑器输入/移动及多字段共享 awareness 时的节点数量。
- 修改 `eslint.config.js`：只对 `src/lib/collaboration/richtext/**/*.test.ts` 放开 Node 内置测试运行器规则。
- 修改 `package.json`、`pnpm-lock.yaml`：加入仅测试使用的 `happy-dom` 开发依赖。
- 持续修改本计划：勾选已完成步骤并记录每条验证命令的真实结果。

---

### 任务 1：行为不变地提取 caret DOM 构造器

**文件：**

- 新建：`src/lib/collaboration/richtext/caret-dom.ts`
- 修改：`src/lib/collaboration/richtext/collab-extensions.ts:36-49,138`
- 修改：`docs/superpowers/plans/2026-07-26-collaboration-caret-atomic-widget.md`

- [x] **步骤 1：创建保持现状的 DOM 构造函数**

新增 `src/lib/collaboration/richtext/caret-dom.ts`。本步骤刻意保留 `<div>` 标签，确保只是提取，不提前混入行为修复：

```ts
/** 远端光标 DOM：彩色竖线 + 姓名标签（配套 .collaboration-carets CSS）。 */
export function createCollaborationCaret(user: Record<string, any>) {
  const cursor = document.createElement('span')
  cursor.classList.add('collaboration-carets__caret')
  cursor.setAttribute('style', `border-color: ${user.color}`)

  const label = document.createElement('div')
  label.classList.add('collaboration-carets__label')
  label.setAttribute('style', `background-color: ${user.color}`)
  label.insertBefore(document.createTextNode(user.name ?? ''), null)

  cursor.insertBefore(label, null)
  return cursor
}
```

- [x] **步骤 2：让扩展组装使用提取后的函数**

在 `collab-extensions.ts` 中删除原 `renderCaret`，增加相对导入：

```ts
import { createCollaborationCaret } from './caret-dom'
```

并把配置改为：

```ts
DedupeCollaborationCaret.configure({
  provider: collab.provider,
  user: collab.user,
  render: createCollaborationCaret,
})
```

不得修改 `DedupeCollaborationCaret`、`createDedupeAwarenessFilter`、Collaboration fragment 或扩展顺序。

- [x] **步骤 3：验证提取没有破坏类型与构建**

运行：

```bash
pnpm exec eslint src/lib/collaboration/richtext/caret-dom.ts src/lib/collaboration/richtext/collab-extensions.ts --max-warnings 0
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

预期：全部退出码为 0；生产构建成功；diff 中 DOM 结构仍是 `SPAN > DIV`，仅函数位置发生变化。

执行后在本步骤下追加：`执行记录：...`。

执行记录（2026-07-26）：

- 代码质量复审确认 `className` / CSSOM style 属性 / `append` 不是对原构造过程的严格逐语义提取；已恢复 `classList.add`、`setAttribute('style', ...)`、`insertBefore(..., null)` 以及 `cursor` 操作序列，使函数体与基线 `renderCaret` 一致。
- 代码质量复审修复后新鲜复跑：目标 ESLint 退出码 0；`pnpm exec tsc --noEmit` 与 `npx tsc --noEmit` 均退出码 2 且仍只命中已记录的基线 `step-parsing.tsx:5` `TS6133`（`npx` 另有 npm `home` 配置警告）；`pnpm build` 退出码 0，成功转换 5213 个模块；`git diff --check` 退出码 0。
- 规格复审发现初次提取把参数收窄为必填 `name: string` 且丢失了缺省回退；已恢复 `user: Record<string, any>` 和 `document.createTextNode(user.name ?? '')`，保持原 `renderCaret` 在姓名缺省时生成空文本节点的语义。
- `pnpm exec eslint src/lib/collaboration/richtext/caret-dom.ts src/lib/collaboration/richtext/collab-extensions.ts --max-warnings 0`：首次退出码 1，命中基线中 `caret-dedupe` 的内联类型导入规则；拆分为顶层 `import type` 后第二次退出码 1，命中导入排序规则；调整零运行时影响的导入顺序后第三次退出码 0，0 errors / 0 warnings；规格复审修复后复跑仍为退出码 0。
- `pnpm exec tsc --noEmit`：退出码 2；唯一错误为 `src/components/jd-variant/components/steps/step-parsing.tsx:5` 的 `TS6133: 'ScrollArea' is declared but its value is never read`；规格复审修复后复跑仍仅此错误。
- `npx tsc --noEmit`：退出码 2；同一 `TS6133` 错误，另有 npm 对未知 `home` 用户配置的警告；规格复审修复后复跑结果不变。
- 基线证据：`git diff -- src/components/jd-variant/components/steps/step-parsing.tsx` 无输出，且 `git show aabb03fa8f324d1db20fe942af2159432ec310ab:src/components/jd-variant/components/steps/step-parsing.tsx` 已包含该未使用导入；因此该类型错误属于任务前基线，本任务未修改无关文件。
- `pnpm build`：退出码 0，Vite 成功转换 5213 个模块并完成生产构建；输出现有大 chunk 警告；规格复审修复后复跑仍为退出码 0。
- `git diff --check`：退出码 0，无空白错误；规格复审修复后复跑仍为退出码 0。

- [x] **步骤 4：更新计划进度并提交纯重构**

先把任务 1 已完成步骤改为 `- [x]`，再运行：

```bash
git add src/lib/collaboration/richtext/caret-dom.ts src/lib/collaboration/richtext/collab-extensions.ts docs/superpowers/plans/2026-07-26-collaboration-caret-atomic-widget.md
git commit -m "refactor(collab): extract caret DOM builder"
```

预期：只提交上述三个文件，不包含 `.DS_Store`。

---

### 任务 2：用 DOM 语义红灯驱动合法标签结构

**文件：**

- 修改：`package.json`
- 修改：`pnpm-lock.yaml`
- 修改：`eslint.config.js`
- 新建：`src/lib/collaboration/richtext/caret-dom.test.ts`
- 修改：`src/lib/collaboration/richtext/caret-dom.ts`
- 修改：`docs/superpowers/plans/2026-07-26-collaboration-caret-atomic-widget.md`

- [ ] **步骤 1：安装仅测试使用的 DOM 环境**

运行：

```bash
pnpm add -D happy-dom
```

预期：`happy-dom` 只出现在 `devDependencies`，`package.json` 和 `pnpm-lock.yaml` 更新，生产依赖不变。

- [ ] **步骤 2：为 Node 测试加入窄范围 ESLint 配置**

把 `eslint.config.js` 的导出改为两个配置参数；现有主配置保持不变，仅追加：

```ts
}, {
  files: ['src/lib/collaboration/richtext/**/*.test.ts'],
  rules: {
    'test/no-import-node-test': 'off',
  },
})
```

不要恢复已删除的其他目录测试配置，也不要全局关闭该规则。

- [ ] **步骤 3：先写 DOM 语义失败测试**

新增 `src/lib/collaboration/richtext/caret-dom.test.ts`：

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { createCollaborationCaret } from './caret-dom.ts'

function withTestDocument(run: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const window = new Window()
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: window.document,
  })
  try {
    run()
  }
  finally {
    window.close()
    if (previous)
      Object.defineProperty(globalThis, 'document', previous)
    else
      Reflect.deleteProperty(globalThis, 'document')
  }
}

test('creates one legal inline caret label without changing user styling', () => {
  withTestDocument(() => {
    const caret = createCollaborationCaret({ name: 'seams', color: '#6255f6' })
    const labels = caret.querySelectorAll('.collaboration-carets__label')

    assert.equal(caret.tagName, 'SPAN')
    assert.equal(caret.className, 'collaboration-carets__caret')
    assert.equal(caret.style.borderColor, '#6255f6')
    assert.equal(labels.length, 1)
    assert.equal(labels[0]?.tagName, 'SPAN')
    assert.equal(labels[0]?.textContent, 'seams')
    assert.equal((labels[0] as HTMLElement).style.backgroundColor, '#6255f6')
  })
})

test('uses an empty label when the remote user name is missing', () => {
  withTestDocument(() => {
    const caret = createCollaborationCaret({ color: '#6255f6' })
    assert.equal(caret.querySelector('.collaboration-carets__label')?.textContent, '')
  })
})
```

- [ ] **步骤 4：运行测试并确认失败原因准确**

运行：

```bash
node --test --experimental-strip-types src/lib/collaboration/richtext/caret-dom.test.ts
```

预期：第一个测试 FAIL，错误明确为标签实际 `DIV`、期望 `SPAN`；第二个测试通过。若失败来自模块不存在、DOM 未安装或导入错误，先修复测试环境，不能修改生产行为来绕过。

执行后追加真实失败摘要。

- [ ] **步骤 5：做最小 DOM 修复**

只把 `caret-dom.ts` 中的标签创建从：

```ts
const label = document.createElement('div')
```

改为：

```ts
const label = document.createElement('span')
```

其余类名、颜色和文本回退保持不变，不添加 U+2060、强制回流或 DOM 清理逻辑。

- [ ] **步骤 6：运行测试与静态检查并确认通过**

运行：

```bash
node --test --experimental-strip-types src/lib/collaboration/richtext/caret-dom.test.ts
pnpm exec eslint eslint.config.js src/lib/collaboration/richtext/caret-dom.ts src/lib/collaboration/richtext/caret-dom.test.ts --max-warnings 0
pnpm exec tsc --noEmit
git diff --check
```

预期：两个测试均 PASS，ESLint、类型检查和 diff 检查退出码均为 0。

执行后追加真实结果。

- [ ] **步骤 7：更新计划进度并提交 DOM 契约修复**

```bash
git add package.json pnpm-lock.yaml eslint.config.js src/lib/collaboration/richtext/caret-dom.ts src/lib/collaboration/richtext/caret-dom.test.ts docs/superpowers/plans/2026-07-26-collaboration-caret-atomic-widget.md
git commit -m "fix(collab): use inline caret label"
```

预期：提交包含测试依赖、窄范围 lint 配置、失败测试的绿灯实现和计划记录，不包含 `.DS_Store`。

---

### 任务 3：用编译后 CSS 红灯驱动原子盒几何

**文件：**

- 新建：`src/lib/collaboration/richtext/caret-style.test.ts`
- 修改：`src/components/tiptap-node/paragraph-node/paragraph-node.scss:109-117`
- 修改：`docs/superpowers/plans/2026-07-26-collaboration-caret-atomic-widget.md`

- [ ] **步骤 1：先写精确选择器的 CSS 契约测试**

新增 `src/lib/collaboration/richtext/caret-style.test.ts`：

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass-embedded'

const stylesheetPath = fileURLToPath(new URL(
  '../../../components/tiptap-node/paragraph-node/paragraph-node.scss',
  import.meta.url,
))

function getCaretDeclarations() {
  const css = compile(stylesheetPath).css
  const match = css.match(
    /(?:^|\})\s*\.tiptap\.ProseMirror \.collaboration-carets__caret\s*\{([^}]*)\}/m,
  )
  assert.ok(match?.[1], 'compiled caret selector must exist')
  return new Map(match[1]
    .split(';')
    .map(declaration => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separator = declaration.indexOf(':')
      assert.notEqual(separator, -1, `invalid declaration: ${declaration}`)
      return [
        declaration.slice(0, separator).trim(),
        declaration.slice(separator + 1).trim(),
      ] as const
    }))
}

test('caret selector defines a zero-net-width atomic inline box', () => {
  const declarations = getCaretDeclarations()

  assert.equal(declarations.get('display'), 'inline-block')
  assert.equal(declarations.get('width'), '0')
  assert.equal(declarations.get('height'), '1em')
  assert.equal(declarations.get('vertical-align'), 'text-bottom')
  assert.equal(declarations.get('border-left'), '1px solid transparent')
  assert.equal(declarations.get('border-right'), '1px solid transparent')
  assert.equal(declarations.get('margin-left'), '-1px')
  assert.equal(declarations.get('margin-right'), '-1px')
})
```

该测试要求目标选择器前必须是样式表起点或上一个规则的 `}`，并把该规则的声明解析为属性 Map 后按完整属性名比较；带前缀的更长选择器、`min-width`、`min-height` 或自定义属性都不能造成误通过。

- [ ] **步骤 2：运行测试并确认几何契约先失败**

运行：

```bash
node --test --experimental-strip-types src/lib/collaboration/richtext/caret-style.test.ts
```

预期：FAIL，第一条缺失声明应为 `display: inline-block`；目标选择器、既有双边框和负 margin 能被正确提取。若正则未找到选择器，修复测试提取逻辑后重跑。

执行后追加真实失败摘要。

- [ ] **步骤 3：补齐最小原子盒样式**

在 `.collaboration-carets__caret` 规则中加入以下四项；保留现有声明：

```scss
display: inline-block;
width: 0;
height: 1em;
vertical-align: text-bottom;
```

完整几何要点必须同时保留：

```scss
border-right: 1px solid transparent;
border-left: 1px solid transparent;
margin-left: -1px;
margin-right: -1px;
position: relative;
```

不得增加 `will-change`、`translateZ`、MutationObserver 或定时清理。

- [ ] **步骤 4：运行 DOM 与 CSS 测试并确认通过**

运行：

```bash
node --test --experimental-strip-types src/lib/collaboration/richtext/caret-dom.test.ts src/lib/collaboration/richtext/caret-style.test.ts
pnpm exec eslint src/lib/collaboration/richtext/caret-style.test.ts --max-warnings 0
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

预期：两个测试文件全部 PASS；ESLint、类型检查、生产构建和 diff 检查退出码均为 0。

执行后追加真实结果。

- [ ] **步骤 5：更新计划进度并提交几何修复**

```bash
git add src/lib/collaboration/richtext/caret-style.test.ts src/components/tiptap-node/paragraph-node/paragraph-node.scss docs/superpowers/plans/2026-07-26-collaboration-caret-atomic-widget.md
git commit -m "fix(collab): make caret widget atomic"
```

预期：只提交 CSS 契约测试、对应样式和计划记录。

---

### 任务 4：锁定真实双编辑器与多字段节点生命周期

**文件：**

- 新建：`src/lib/collaboration/richtext/caret-lifecycle.integration.test.ts`
- 修改：`docs/superpowers/plans/2026-07-26-collaboration-caret-atomic-widget.md`

- [ ] **步骤 1：新增真实 Tiptap/Yjs 生命周期集成测试**

新增 `src/lib/collaboration/richtext/caret-lifecycle.integration.test.ts`。使用真实依赖，不 mock ProseMirror DecorationSet；测试辅助代码保持在测试文件中：

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Editor } from '@tiptap/core'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import StarterKit from '@tiptap/starter-kit'
import { Window } from 'happy-dom'
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
} from 'y-protocols/awareness'
import * as Y from 'yjs'
import { createCollaborationCaret } from './caret-dom.ts'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

interface AwarenessChanges {
  added: number[]
  updated: number[]
  removed: number[]
}

function installDom() {
  const browser = new Window({ url: 'http://localhost/' })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: browser.navigator,
  })
  Object.assign(globalThis, {
    window: browser,
    document: browser.document,
    Node: browser.Node,
    Text: browser.Text,
    HTMLElement: browser.HTMLElement,
    Element: browser.Element,
    MutationObserver: browser.MutationObserver,
    DOMParser: browser.DOMParser,
    getComputedStyle: browser.getComputedStyle.bind(browser),
    requestAnimationFrame: (callback: (timestamp: number) => void) =>
      setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
  })
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  return browser
}

function connectDocs(left: Y.Doc, right: Y.Doc) {
  left.on('update', (update, origin) => {
    if (origin !== right)
      Y.applyUpdate(right, update, left)
  })
  right.on('update', (update, origin) => {
    if (origin !== left)
      Y.applyUpdate(left, update, right)
  })
}

function connectAwareness(left: Awareness, right: Awareness) {
  left.on('update', ({ added, updated, removed }: AwarenessChanges, origin: unknown) => {
    if (origin === right)
      return
    applyAwarenessUpdate(
      right,
      encodeAwarenessUpdate(left, [...added, ...updated, ...removed]),
      left,
    )
  })
  right.on('update', ({ added, updated, removed }: AwarenessChanges, origin: unknown) => {
    if (origin === left)
      return
    applyAwarenessUpdate(
      left,
      encodeAwarenessUpdate(right, [...added, ...updated, ...removed]),
      right,
    )
  })
}

function createEditor(
  element: HTMLElement,
  fragment: Y.XmlFragment,
  awareness: Awareness,
  user: { id: string, name: string, color: string },
) {
  return new Editor({
    element,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ fragment }),
      CollaborationCaret.configure({
        provider: { awareness },
        user,
        render: createCollaborationCaret,
      }),
    ],
  })
}

function assertRemoteWidgetCount(element: HTMLElement, expected: number) {
  assert.equal(element.querySelectorAll('.collaboration-carets__caret').length, expected)
  assert.equal(element.querySelectorAll('.collaboration-carets__label').length, expected)
}

test('remote typing and selection moves keep one caret and one label', async () => {
  const browser = installDom()
  const hostElement = document.createElement('div')
  const guestElement = document.createElement('div')
  document.body.append(hostElement, guestElement)
  const hostDoc = new Y.Doc()
  const guestDoc = new Y.Doc()
  connectDocs(hostDoc, guestDoc)
  const hostAwareness = new Awareness(hostDoc)
  const guestAwareness = new Awareness(guestDoc)
  connectAwareness(hostAwareness, guestAwareness)
  const host = createEditor(
    hostElement,
    hostDoc.getXmlFragment('field-a'),
    hostAwareness,
    { id: 'host', name: 'seams', color: '#6255f6' },
  )
  const guest = createEditor(
    guestElement,
    guestDoc.getXmlFragment('field-a'),
    guestAwareness,
    { id: 'guest', name: 'guest', color: '#38bdf8' },
  )

  try {
    await tick()
    host.commands.focus('end')
    await tick()
    for (const character of '11222222222222222222') {
      host.commands.insertContent(character)
      await tick()
      assertRemoteWidgetCount(guestElement, 1)
    }
    host.commands.setTextSelection(2)
    await tick()
    assertRemoteWidgetCount(guestElement, 1)
    assert.equal(guestElement.querySelector('.collaboration-carets__label')?.textContent, 'seams')
  }
  finally {
    host.destroy()
    guest.destroy()
    hostAwareness.destroy()
    guestAwareness.destroy()
    hostDoc.destroy()
    guestDoc.destroy()
    browser.close()
  }
})
```

- [ ] **步骤 2：在同一测试文件追加多字段共享 awareness 场景**

复用上述 helper，创建 host/guest 各两个 editor，分别绑定 `field-a`、`field-b`，但同一侧共享一个 `Y.Doc` 和一个 `Awareness`：

```ts
test('shared awareness renders a label only in the active remote field', async () => {
  const browser = installDom()
  const hostElementA = document.createElement('div')
  const hostElementB = document.createElement('div')
  const guestElementA = document.createElement('div')
  const guestElementB = document.createElement('div')
  document.body.append(hostElementA, hostElementB, guestElementA, guestElementB)
  const hostDoc = new Y.Doc()
  const guestDoc = new Y.Doc()
  connectDocs(hostDoc, guestDoc)
  const hostAwareness = new Awareness(hostDoc)
  const guestAwareness = new Awareness(guestDoc)
  connectAwareness(hostAwareness, guestAwareness)
  const hostUser = { id: 'host', name: 'seams', color: '#6255f6' }
  const guestUser = { id: 'guest', name: 'guest', color: '#38bdf8' }
  const hostFieldA = createEditor(
    hostElementA,
    hostDoc.getXmlFragment('field-a'),
    hostAwareness,
    hostUser,
  )
  const hostFieldB = createEditor(
    hostElementB,
    hostDoc.getXmlFragment('field-b'),
    hostAwareness,
    hostUser,
  )
  const guestFieldA = createEditor(
    guestElementA,
    guestDoc.getXmlFragment('field-a'),
    guestAwareness,
    guestUser,
  )
  const guestFieldB = createEditor(
    guestElementB,
    guestDoc.getXmlFragment('field-b'),
    guestAwareness,
    guestUser,
  )

  try {
    await tick()
    hostFieldA.commands.focus('end')
    await tick()
    hostFieldA.commands.insertContent('shared-awareness')
    await tick()
    assertRemoteWidgetCount(guestElementA, 1)
    assertRemoteWidgetCount(guestElementB, 0)

    hostFieldA.commands.blur()
    await tick()
    hostFieldB.commands.focus('end')
    await tick()
    hostFieldB.commands.insertContent('second-field')
    await tick()
    assertRemoteWidgetCount(guestElementA, 0)
    assertRemoteWidgetCount(guestElementB, 1)
  }
  finally {
    hostFieldA.destroy()
    hostFieldB.destroy()
    guestFieldA.destroy()
    guestFieldB.destroy()
    hostAwareness.destroy()
    guestAwareness.destroy()
    hostDoc.destroy()
    guestDoc.destroy()
    browser.close()
  }
})
```

该测试验证共享 awareness 的字段切换，不重新测试或修改身份去重算法。

- [ ] **步骤 3：运行完整协作光标测试组**

运行：

```bash
node --test --experimental-strip-types \
  src/lib/collaboration/richtext/caret-dom.test.ts \
  src/lib/collaboration/richtext/caret-style.test.ts \
  src/lib/collaboration/richtext/caret-lifecycle.integration.test.ts
```

预期：全部 PASS；单字段每个输入采样点始终为一个 caret 和一个 label；多字段切换后只有当前字段各有一个 caret 和一个 label。

如果多字段测试与临时诊断结果不同，先检查 focus/focusout 事件和异步 tick，不能通过放宽数量断言来“修复”测试。

执行后追加真实结果。

- [ ] **步骤 4：运行测试文件的静态检查**

运行：

```bash
pnpm exec eslint \
  src/lib/collaboration/richtext/caret-dom.ts \
  src/lib/collaboration/richtext/caret-dom.test.ts \
  src/lib/collaboration/richtext/caret-style.test.ts \
  src/lib/collaboration/richtext/caret-lifecycle.integration.test.ts \
  --max-warnings 0
pnpm exec tsc --noEmit
git diff --check
```

预期：全部退出码为 0。只修复测试本身的类型/格式问题，不扩大生产实现。

执行后追加真实结果。

- [ ] **步骤 5：更新计划进度并提交生命周期回归**

```bash
git add src/lib/collaboration/richtext/caret-lifecycle.integration.test.ts docs/superpowers/plans/2026-07-26-collaboration-caret-atomic-widget.md
git commit -m "test(collab): cover caret widget lifecycle"
```

预期：只提交生命周期测试和计划记录。

---

### 任务 5：完整验证与双账号视觉验收

**文件：**

- 验证：`src/lib/collaboration/richtext/caret-dom.ts`
- 验证：`src/lib/collaboration/richtext/collab-extensions.ts`
- 验证：`src/components/tiptap-node/paragraph-node/paragraph-node.scss`
- 验证：`src/lib/collaboration/richtext/*.test.ts`
- 修改：`docs/superpowers/plans/2026-07-26-collaboration-caret-atomic-widget.md`

- [ ] **步骤 1：运行自动化验证基线**

运行：

```bash
node --test --experimental-strip-types \
  src/lib/collaboration/richtext/caret-dom.test.ts \
  src/lib/collaboration/richtext/caret-style.test.ts \
  src/lib/collaboration/richtext/caret-lifecycle.integration.test.ts
pnpm exec eslint \
  eslint.config.js \
  src/lib/collaboration/richtext/caret-dom.ts \
  src/lib/collaboration/richtext/collab-extensions.ts \
  src/lib/collaboration/richtext/caret-dom.test.ts \
  src/lib/collaboration/richtext/caret-style.test.ts \
  src/lib/collaboration/richtext/caret-lifecycle.integration.test.ts \
  --max-warnings 0
pnpm exec tsc --noEmit
pnpm build
git diff --check
git status --short
```

预期：测试、ESLint、类型检查、构建和 diff 检查全部退出码为 0；`git status --short` 只保留用户原有 `.DS_Store` 变更以及尚未提交的计划执行记录。

执行后追加每条命令的真实结果；若全仓基线阻塞，记录完整错误并再运行只覆盖本次文件的最窄验证，不能把失败写成通过。

- [ ] **步骤 2：执行双账号浏览器回归**

使用两个不同账号进入同一协作会话，按顺序验证并逐项记录：

1. 发起者在同一行连续输入至少 20 个字符；协作者侧始终只有一个完整昵称气泡。
2. 发起者使用方向键和鼠标在同一字段移动；旧位置没有残片。
3. 发起者输入多行并跨行移动；旧行没有残留气泡。
4. 发起者在两个富文本字段之间切换；只有当前字段显示气泡。
5. 协作者反向输入；发起者侧仍正常。
6. 在至少两种字号或行高下检查竖线高度与昵称位置；`text-bottom` 不抬高行盒、不遮挡正文。

预期：六项全部通过。执行后在本步骤追加每项结果。

如果当前环境没有双账号登录态，本步骤保持 `- [ ]`，追加“未执行：缺少双账号登录态”，并在交付时明确请用户验收；不得宣称视觉问题已经完全修复。

此时停止执行任务 5 的步骤 3–4，以“待用户双账号验收”状态交付，不把目标任务标记为完成；收到用户验收结果后再继续。

- [ ] **步骤 3：按视觉结果决定完成或回退调查**

若步骤 2 全部通过，进入步骤 4。

若仍出现堆叠或残片：停止添加 CSS workaround，不提交“完成”状态；先记录异常时的 DOM caret 数量、`awareness.getStates()` 中发起者 clientId/user/cursor/meta、Decoration key/字段/位置，然后用新的修复提交撤销原子 widget 的 DOM/CSS 行为改动及相应契约断言。保留诊断记录并返回系统化调试，不进入外浮层或 provider 改造，除非另行更新规格并取得用户确认。

- [ ] **步骤 4：更新最终执行记录并提交**

先确保所有实际完成步骤已勾选、所有验证都附有真实执行记录，然后运行：

```bash
git add docs/superpowers/plans/2026-07-26-collaboration-caret-atomic-widget.md
git commit -m "docs(collab): record caret fix verification"
```

预期：只提交最终计划执行记录。没有用户明确要求时，到此为止，不运行 `git push`。
