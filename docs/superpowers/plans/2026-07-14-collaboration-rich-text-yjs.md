# 富文本实时协作（Yjs + Tiptap）实施计划（子项目 B）

> **给代理执行者：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐步实现本计划。步骤用复选框（`- [ ]`）跟踪，执行时同步更新本文件：完成的步骤改 `- [x]`，验证步骤追加 `执行记录：...`（真实命令结果或环境限制），受阻/跳过步骤保持未勾选并注明原因。

**目标：** 让 9 个 Tiptap 富文本编辑器在协作会话中由 Yjs 驱动，实现同字段字符级无冲突合并 + 编辑器内彩色远端光标/选区；富文本仍镜像为 HTML 落 Automerge，preview/PDF/历史零改动。

**架构：** 新增 Yjs 层（会话级 `Y.Doc` + `Awareness` + Supabase 传输 provider，平行于现有 `SupabaseNetworkAdapter`）。`SimpleEditor` 双模式：协作开启用 `Collaboration`+`CollaborationCaret`（禁用 StarterKit 的 history、不传 content）、keyed remount；`onUpdate` 去抖镜像 HTML 到现有 `field.onChange`→A 的 `rich`=LWW 写路径。host 在初始同步完成后对空 fragment 种子化现有 HTML。

**技术栈：** Yjs 13、y-protocols、y-prosemirror、`@tiptap/extension-collaboration`、`@tiptap/extension-collaboration-caret`、Supabase Realtime broadcast、Node 22 内置测试运行器。

**规格：** `docs/superpowers/specs/2026-07-14-collaboration-rich-text-yjs-design.md`

---

## 关键约束

- **StarterKit history 冲突**：Tiptap `Collaboration` 自带基于 Yjs 的 undo/redo，必须在协作模式 `StarterKit.configure({ undoRedo: false })`（或对应 history 关闭项），否则与 Yjs 冲突。standalone 模式保持默认。
- **协作模式不传 `content`**：否则每个 peer 都注入初始内容导致重复。
- **模式切换必须 keyed remount**：`useEditor` 仅创建时读 `extensions`。
- **纯函数测试脱 `@/` 别名**：`node --test --experimental-strip-types`，同子项目 A 约定。带 `@/`/DOM/Yjs-view 的模块不写 node 纯测，用 Yjs 层集成测试（真实 `yjs` 包，允许 import）或浏览器验证。
- **tsc 基线**：仓库预存 1 个无关错误 `src/components/jd-variant/components/steps/step-parsing.tsx(5,1) TS6133`，以此为基线，不得新增其他错误。
- **不得为闭环加冗余断路器**（见 spec §3.7，已验证无死循环）。

---

## 文件结构

**新建：**
- `src/lib/collaboration/richtext/fragment-key.ts` —— 纯函数 `buildFragmentKey(sectionKey, relativePath)`。无 `@/`/Yjs 依赖，可 node 测试。
- `src/lib/collaboration/richtext/fragment-key.test.ts`
- `src/lib/collaboration/richtext/yjs-doc.ts` —— 会话级 `RichTextCollabSession`：创建/销毁 `Y.Doc` + `Awareness`；`getFieldFragment(key): Y.XmlFragment`。
- `src/lib/collaboration/richtext/supabase-yjs-provider.ts` —— `SupabaseYjsProvider`：Supabase broadcast 上的 Yjs sync（step1/2 + update 广播）+ awareness 编解码 + presence/离开清理。
- `src/lib/collaboration/richtext/seed.ts` —— `seedFragmentFromHtml(fragment, html, extensions)`：host 用 `generateJSON`+`schema.nodeFromJSON`+`prosemirrorToYXmlFragment` 注入；仅空 fragment。
- `src/lib/collaboration/richtext/collab-extensions.ts` —— 构造协作扩展数组的工厂（复用编辑器全部扩展 + `Collaboration` + `CollaborationCaret`，关闭 history）。
- `src/lib/collaboration/richtext/store.ts` —— `useRichTextCollabStore`（Zustand）：`{ session: RichTextCollabSession | null, isReady }`；或并入现有 collaboration store。
- `src/lib/collaboration/richtext/index.ts` —— barrel 导出。
- `src/lib/collaboration/richtext/mirror-debounce.ts` —— 纯工具 `createDebouncedMirror(fn, wait)` 返回 `{ run, flush, cancel }`（可 node 测试，用 fake timer/手动 flush）。
- `src/lib/collaboration/richtext/mirror-debounce.test.ts`

**修改：**
- `src/components/tiptap-templates/simple/simple-editor.tsx` —— 新增可选 `collab?: { fragment, provider, user, onMirror }`；协作时 keyed remount + 协作扩展 + 去抖镜像；standalone 不变、向后兼容。
- 9 个富文本表单文件（`self-evaluation`、`hobbies`、`honors-certificates`、`skill-specialty`、`work-experience`、`internship-experience`、`project-experience`、`edu-background`、`campus-experience`）—— 按协作状态给对应 `SimpleEditor` 传 `collab`（fragment 由 `buildFragmentKey` 取）。
- `src/lib/collaboration/session/store.ts` + `service.ts` —— 会话 enable 成功后创建 Yjs 层、disable/remote-end 时销毁（含去抖 flush）。
- `package.json` —— 新增依赖。

---

## 任务 0：安装依赖

- [ ] **步骤 1：安装**

运行：`pnpm add yjs y-protocols @tiptap/extension-collaboration @tiptap/extension-collaboration-caret`
预期：安装成功。**重要**：Tiptap v3 的 `@tiptap/extension-collaboration` 依赖 **`@tiptap/y-tiptap`**（y-prosemirror 的 fork），**不是** `y-prosemirror`。种子化应使用**与编辑器同一绑定**（`@tiptap/y-tiptap`）的 PM→Yjs 转换 API，避免双绑定编码不一致；执行时用 `node -e "console.log(Object.keys(require('@tiptap/y-tiptap')))"` 查实际导出名（如 `prosemirrorToYXmlFragment` / `prosemirrorJSONToYDoc`），并据此写种子化。故**不单独安装 `y-prosemirror`**（它会随 collaboration 传递依赖进来，但我们只用 y-tiptap 的导出）。
执行记录：（填写实际安装版本；记录 `@tiptap/y-tiptap` 的种子化导出名；若 peer 冲突记录解决方式）

- [ ] **步骤 2：验证可 import + 构建未破坏**

运行：`npx tsc --noEmit`（仅基线错误）；`node -e "require('yjs');require('y-protocols/awareness')"` 确认可解析。
执行记录：（填写）

- [ ] **步骤 3：提交**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(collab): add yjs + tiptap collaboration deps for rich-text collab"
```

---

## 任务 1：fragment-key 纯函数

**文件：**
- 新建：`src/lib/collaboration/richtext/fragment-key.ts`
- 测试：`src/lib/collaboration/richtext/fragment-key.test.ts`
- 修改：`eslint.config.js`

- [ ] **步骤 0：扩展 ESLint override 覆盖新测试目录**

现有 override 只覆盖 `src/hooks/collab/**/*.test.ts`（关掉 `test/no-import-node-test`、`style/max-statements-per-line`）。本子项目测试在 `src/lib/collaboration/richtext/`，需把该 override 的 `files` 改为同时匹配：`['src/hooks/collab/**/*.test.ts', 'src/lib/collaboration/richtext/**/*.test.ts']`（含 `*.integration.test.ts`）。否则 `import { test } from 'node:test'` 与 `mirror-debounce.test.ts` 的多语句行会被 lint 拦下。

- [ ] **步骤 1：先写失败测试**

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildFragmentKey } from './fragment-key.ts'

test('section-level rich field key', () => {
  assert.equal(buildFragmentKey('self_evaluation', 'content'), 'self_evaluation.content')
  assert.equal(buildFragmentKey('hobbies', 'description'), 'hobbies.description')
})

test('array-item rich field key preserves index', () => {
  assert.equal(buildFragmentKey('work_experience', 'items.0.workInfo'), 'work_experience.items.0.workInfo')
  assert.equal(buildFragmentKey('project_experience', 'items.2.projectInfo'), 'project_experience.items.2.projectInfo')
})

test('distinct fields produce distinct keys', () => {
  assert.notEqual(
    buildFragmentKey('work_experience', 'items.0.workInfo'),
    buildFragmentKey('work_experience', 'items.1.workInfo'),
  )
})
```

- [ ] **步骤 2：运行并确认失败**

运行：`node --test --experimental-strip-types src/lib/collaboration/richtext/fragment-key.test.ts`
预期：FAIL（模块不存在）

- [ ] **步骤 3：写最小实现**

`buildFragmentKey(sectionKey, relativePath) => relativePath ? \`${sectionKey}.${relativePath}\` : sectionKey`。稳定、确定、可区分。

- [ ] **步骤 4：运行并确认通过**

运行：`node --test --experimental-strip-types src/lib/collaboration/richtext/fragment-key.test.ts`
预期：PASS

- [ ] **步骤 5：提交**

```bash
git add src/lib/collaboration/richtext/fragment-key.ts src/lib/collaboration/richtext/fragment-key.test.ts
git commit -m "feat(collab): add rich-text fragment key builder"
```

---

## 任务 2：去抖镜像工具

**文件：**
- 新建：`src/lib/collaboration/richtext/mirror-debounce.ts`
- 测试：`src/lib/collaboration/richtext/mirror-debounce.test.ts`

`createDebouncedMirror(fn, wait)` 返回 `{ run(arg), flush(), cancel() }`：`run` 延后 `wait` 调用 `fn`（后值覆盖）；`flush` 立即执行挂起的一次（用最后一次 arg）；`cancel` 丢弃。用 `setTimeout`；测试用 `node:test` 的 mock timers。

- [ ] **步骤 1：先写失败测试**

```ts
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { createDebouncedMirror } from './mirror-debounce.ts'

test('debounces and coalesces to last value', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const seen: string[] = []
  const m = createDebouncedMirror((v: string) => seen.push(v), 300)
  m.run('a'); m.run('b'); m.run('c')
  assert.deepEqual(seen, [])
  mock.timers.tick(300)
  assert.deepEqual(seen, ['c'])
  mock.timers.reset()
})

test('flush runs pending immediately with last value', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const seen: string[] = []
  const m = createDebouncedMirror((v: string) => seen.push(v), 300)
  m.run('x'); m.flush()
  assert.deepEqual(seen, ['x'])
  mock.timers.tick(300) // 不应再次触发
  assert.deepEqual(seen, ['x'])
  mock.timers.reset()
})

test('cancel discards pending', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const seen: string[] = []
  const m = createDebouncedMirror((v: string) => seen.push(v), 300)
  m.run('y'); m.cancel(); mock.timers.tick(300)
  assert.deepEqual(seen, [])
  mock.timers.reset()
})
```

- [ ] **步骤 2：运行并确认失败**

运行：`node --test --experimental-strip-types src/lib/collaboration/richtext/mirror-debounce.test.ts`
预期：FAIL

- [ ] **步骤 3：写最小实现**（`setTimeout` + 保存最后 arg + `flush`/`cancel` 清 timer）

- [ ] **步骤 4：运行并确认通过**

运行：`node --test --experimental-strip-types src/lib/collaboration/richtext/mirror-debounce.test.ts`
预期：PASS

- [ ] **步骤 5：提交**

```bash
git add src/lib/collaboration/richtext/mirror-debounce.ts src/lib/collaboration/richtext/mirror-debounce.test.ts
git commit -m "feat(collab): add debounced HTML mirror utility with flush"
```

---

## 任务 3：会话级 Y.Doc + Awareness（`yjs-doc.ts`）

**文件：**
- 新建：`src/lib/collaboration/richtext/yjs-doc.ts`
- 参考：spec §3.2、§3.6

`RichTextCollabSession` 类：
- 构造：`new Y.Doc()`、`new Awareness(doc)`（来自 `y-protocols/awareness`）。
- `getFieldFragment(key: string): Y.XmlFragment` → `doc.getXmlFragment(key)`。
- `setLocalUser({ name, color })` → `awareness.setLocalStateField('user', { name, color })`（CollaborationCaret 约定读取 `user`）。
- `destroy()` → `awareness.destroy()`、`doc.destroy()`。

> 该文件 import `yjs`/`y-protocols`（npm 包，node 可解析），但主要经集成测试与浏览器验证；本任务只做类型检查 + 一个轻量 Yjs 集成测试（可选）。

- [ ] **步骤 1：实现 `RichTextCollabSession`**
- [ ] **步骤 2：（可选）Yjs 集成测试** `yjs-doc.integration.test.ts`：`getFieldFragment` 幂等返回同一 fragment；`setLocalUser` 写入 awareness local state。

运行：`node --test --experimental-strip-types src/lib/collaboration/richtext/yjs-doc.integration.test.ts`
执行记录：（填写；若 Yjs 在 strip-types 下 import 异常则记录并转浏览器验证）

- [ ] **步骤 3：类型检查**

运行：`npx tsc --noEmit`（仅基线错误）
执行记录：（填写）

- [ ] **步骤 4：提交**

```bash
git add src/lib/collaboration/richtext/yjs-doc.ts src/lib/collaboration/richtext/yjs-doc.integration.test.ts
git commit -m "feat(collab): add session-scoped Yjs doc + awareness"
```

---

## 任务 4：Supabase Yjs 传输 provider

**文件：**
- 新建：`src/lib/collaboration/richtext/supabase-yjs-provider.ts`
- 参考：`src/lib/automerge/collaboration/supabase-network-adapter.ts`（频道/presence/base64 模式）、`src/lib/automerge/shared`（`encodeBytesToBase64`/`decodeBase64ToBytes`）

`SupabaseYjsProvider`（构造 `resumeId, sessionId, doc, awareness`）：
- **公共 `awareness` 字段**：必须以 `public readonly awareness` 暴露传入的 `Awareness` 实例——`CollaborationCaret.configure({ provider })` 会读 `provider.awareness` 渲染远端光标。
- 频道 `yjs:resume:<resumeId>:<sessionId>`。
- **doc sync**：`doc.on('update', (update, origin) => { if (origin !== this) broadcast('yjs-update', base64(update)) })`；收 `yjs-update` → `Y.applyUpdate(doc, bytes, this)`（origin=this 防回环）。
- **初始同步**：subscribe 成功后用 `y-protocols/sync` 的 `writeSyncStep1`/`readSyncMessage` 交换状态向量；或简化：新加入者广播 `yjs-sync-request`，在场者回其完整 `Y.encodeStateAsUpdate(doc)`。选后者更简单可靠。
- **awareness**：`awareness.on('update', ({added,updated,removed}) => broadcast('yjs-awareness', base64(encodeAwarenessUpdate(awareness, changedClients))))`；收 → `applyAwarenessUpdate(awareness, bytes, this)`。
- **presence/清理**：本频道 presence；peer leave → `removeAwarenessStates(awareness, [theirClientId], this)`。
- `connect()`/`destroy()`：subscribe/unsubscribe、解绑所有监听。

> 该文件 import `@/lib/supabase/client` 与 `yjs`/`y-protocols`，**不写 node 纯测**；编解码若抽出纯函数则单测。

- [ ] **步骤 1：实现 provider**（doc update 广播 + apply、sync-request/response、awareness 广播 + apply、presence 清理、destroy 全解绑）
- [ ] **步骤 2：类型检查**

运行：`npx tsc --noEmit`（仅基线错误）
执行记录：（填写）

- [ ] **步骤 3：提交**

```bash
git add src/lib/collaboration/richtext/supabase-yjs-provider.ts
git commit -m "feat(collab): add Supabase transport provider for Yjs doc + awareness"
```

---

## 任务 5：种子化 + 协作扩展工厂

**文件：**
- 新建：`src/lib/collaboration/richtext/collab-extensions.ts`
- 新建：`src/lib/collaboration/richtext/seed.ts`
- 参考：`simple-editor.tsx` 的完整 `extensions` 数组

`collab-extensions.ts`：导出 `buildEditorExtensions({ collab })`：返回编辑器扩展数组。standalone = 现有全套；collaborative = 现有全套但 `StarterKit.configure({ undoRedo: false })`（关 history）+ 追加 `Collaboration.configure({ fragment })` + `CollaborationCaret.configure({ provider: awarenessProvider, user })`。把 `simple-editor.tsx` 现有 extensions 抽到此工厂以复用。

`seed.ts`：`seedFragmentFromHtml(fragment, html, extensions)`：
- 若 `fragment.length > 0` 立即 return（原子空检查）。
- `const json = generateJSON(html, extensions)`；用 **`@tiptap/y-tiptap`** 的转换 API（与编辑器 Collaboration 同一绑定，导出名执行时确认，通常 `prosemirrorToYXmlFragment(pmDoc, fragment)` 或 `prosemirrorJSONToYDoc`）把 JSON 写入 fragment。若该绑定只提供 `Y.Doc` 级 API，则用编辑器同名 fragment 键构造后合并。**不要**混用 `y-prosemirror` 的独立实现，避免与 y-tiptap 的 `ySyncPlugin` 编码不一致。
- `schema` 由 `getSchema(extensions)` 得（`Node.fromJSON` 需要）。
- 用**与编辑器完全一致**的 extensions（含 HorizontalRule/ImageUploadNode/Selection 等），否则丢节点。

- [ ] **步骤 1：抽取扩展工厂**（把 `simple-editor.tsx` 的 extensions 移到 `collab-extensions.ts`，standalone 分支保持等价）
- [ ] **步骤 2：实现 `seedFragmentFromHtml`**
- [ ] **步骤 3：类型检查 + 构建**

运行：`npx tsc --noEmit`（仅基线）；`pnpm build`（确保扩展抽取未破坏编辑器）
执行记录：（填写）

- [ ] **步骤 4：提交**

```bash
git add src/lib/collaboration/richtext/collab-extensions.ts src/lib/collaboration/richtext/seed.ts src/components/tiptap-templates/simple/simple-editor.tsx
git commit -m "feat(collab): add collab extension factory + fragment HTML seeding"
```

---

## 任务 6：Yjs 层生命周期接线（store + session）

**文件：**
- 新建：`src/lib/collaboration/richtext/store.ts`
- 修改：`src/lib/collaboration/session/store.ts`（`startSharing`/`joinSession`/`resumeHosting` 成功后创建；`stopSharing`/`handleRemoteShareEnd` 销毁）
- 参考：`session/state.ts`（role/selfColor/selfUserId、participants[peerId].metadata.userName）

`store.ts`：`useRichTextCollabStore`：`{ session: RichTextCollabSession | null, provider: SupabaseYjsProvider | null, ready: boolean, setSession(...), clear() }`。

session 接线：
- **接线点**：`session/store.ts` 的 `activateSession()` 内，`set(createConnectedSessionState(result))` 之后。此处 `result` 直接携带 `sessionId`/`resumeId`/`userId`/`userName`/`role`/`color`/`selfPeerId`。**注意**：`userName` **不是**顶层 session state 字段（state 只有 `selfColor`/`selfUserId`），必须从 `result.userName`（或 `participants[selfPeerId].metadata.userName`）取，不能像 `selfColor` 那样从 store state 读。
- 会话激活成功后：`new RichTextCollabSession()` → `new SupabaseYjsProvider(resumeId, sessionId, doc, awareness)` → `provider.connect()` → `session.setLocalUser({ name: result.userName, color: result.color })` → 存入 `useRichTextCollabStore`。
- **种子化**：仅 `role==='host'`，在 provider 初始同步 settle 后（sync-response 收到或超时兜底）对 9 个 fragment 调 `seedFragmentFromHtml`（HTML 取自当前 store 的对应字段）。空检查在写入前。
- **重连幂等**：`resumeHosting` 无 `stopSharing` 前置守卫，重连时须先 `clear()` 旧 Yjs 层（销毁旧 doc/provider）再新建，避免泄漏第二个 `Y.Doc`/provider。
- 销毁：`stopSharing`/`handleRemoteShareEnd` 时 `provider.destroy()` + `session.destroy()` + `clear()`。（去抖 flush 在编辑器卸载时处理，见任务 7。）

- [ ] **步骤 1：实现 `useRichTextCollabStore`**
- [ ] **步骤 2：接线 session enable/disable（含 host 种子化、初始同步 gating）**
- [ ] **步骤 3：类型检查**

运行：`npx tsc --noEmit`（仅基线）
执行记录：（填写）

- [ ] **步骤 4：提交**

```bash
git add src/lib/collaboration/richtext/store.ts src/lib/collaboration/session
git commit -m "feat(collab): wire Yjs rich-text session lifecycle + host seeding"
```

---

## 任务 7：SimpleEditor 双模式

**文件：**
- 修改：`src/components/tiptap-templates/simple/simple-editor.tsx`

- 新增可选 prop `collab?: { fragment: Y.XmlFragment, provider: awareness-provider, user: { name, color }, onMirror: (html: string) => void }`。
- `useEditor` 的 `extensions` 由 `buildEditorExtensions({ collab })` 提供；协作时不传 `content`。
- **模式切换必须真正重建 `useEditor` 实例**。有两种正确做法，二选一：
  - **(推荐) `useEditor` 依赖数组**：`@tiptap/react` 的 `useEditor(options, deps?)` 接受依赖数组（已验证签名 `useEditor(options, deps?: DependencyList)`）。传 `[Boolean(collab)]`（及 fragment 引用）作为 deps，切换时自动重建编辑器，无需包裹组件。
  - 或**把调用 `useEditor` 的组件本身**用 `key` 重挂载（例如抽一个内部 `<EditorInstance key={collab ? 'collab' : 'standalone'} />`，`useEditor` 在其内部调用）。
  - **注意**：给 `<EditorContent>` 加 `key` 是**错误**的——`useEditor` 在 `SimpleEditor` 体内调用、`EditorContent` 只是子节点，只 key `EditorContent` 不会重建 `useEditor`，extensions 不会切换、模式切换静默失效。
- **镜像**：协作时 `onUpdate` → `createDebouncedMirror(html => collab.onMirror(html), 300)`；编辑器卸载（useEffect cleanup）时 `flush()`。standalone 保持现有 `onChange`。
- **provider 契约**：`CollaborationCaret.configure({ provider })` 读取 `provider.awareness`，故传入的 provider 对象**必须暴露公共 `.awareness` 字段**（`SupabaseYjsProvider` 需满足）。
- standalone 分支（无 `collab`）行为与现状**完全一致**，保证 `optimize`/`tracker` 两处用途不回归。
- **AiRewriteBubble**：当前在 `editor && fieldContext` 时挂载；确认协作模式下仍挂载可用（其 `insertContentAt` 编辑经 Yjs 流转，无需特殊处理）。

- [ ] **步骤 1：改造 `SimpleEditor` 支持 collab（keyed remount + 协作扩展 + 去抖镜像 + 卸载 flush）**
- [ ] **步骤 2：类型检查 + 构建 + lint**

运行：`npx tsc --noEmit`（仅基线）；`pnpm build`；`npx eslint src/components/tiptap-templates/simple/simple-editor.tsx`
执行记录：（填写）

- [ ] **步骤 3：提交**

```bash
git add src/components/tiptap-templates/simple/simple-editor.tsx
git commit -m "feat(collab): dual-mode SimpleEditor (standalone | Yjs collaborative)"
```

---

## 任务 8：接线 9 个富文本编辑器

**文件（逐个）：** `self-evaluation`、`hobbies`、`honors-certificates`、`skill-specialty`、`work-experience`、`internship-experience`、`project-experience`、`edu-background`、`campus-experience` 的 `index.tsx`

改法：读 `useRichTextCollabStore()` 与 `useCollaborationStore` 的 `isSharing`；协作就绪时给对应 `SimpleEditor` 传 `collab`：
- `fragment = session.getFieldFragment(buildFragmentKey(sectionKey, fieldRelativePath))`
- `provider = awareness provider`、`user = { name, color }`
- `onMirror = (html) => field.onChange(html)`（复用现有 HTML 落库链路）
未协作时不传 `collab`（现状）。数组项字段的 `fieldRelativePath` 用 `items.${index}.${infoField}`。

> 抽一个小 hook `useRichTextCollab(sectionKey, relativePath)` 返回 `collab | undefined`，复用。
>
> **⚠️ rules-of-hooks（`react-hooks/rules-of-hooks` 已启用）**：section 级 4 个字段在表单顶层调用 hook 安全；但 5 个数组字段的编辑器在 `renderItem(index)`（`fields.map` 内）渲染，**不得**在循环里直接调 `useRichTextCollab`。做法：为数组项富文本抽一个**独立子组件** `<RichTextItemEditor sectionKey relativePath field ... />`，在该子组件内部调用 `useRichTextCollab` + 渲染 `SimpleEditor`；`renderItem` 里渲染该子组件（组件调用不违反 hooks 规则）。section 级字段可直接用 hook 或同样走子组件。

- [ ] **步骤 1：新增 `useRichTextCollab(sectionKey, relativePath)` hook（返回 collab 或 undefined）**
- [ ] **步骤 2：新增 `<RichTextItemEditor>` 子组件（内部调 hook + SimpleEditor），供数组项与 section 级复用**
- [ ] **步骤 3：接线 self-evaluation、hobbies、honors-certificates、skill-specialty（section 级字段）**
- [ ] **步骤 4：接线 work/internship/project/edu/campus（数组项 `items.N.*Info`，经 `<RichTextItemEditor>`）**
- [ ] **步骤 5：类型检查 + lint + 构建**

运行：`npx tsc --noEmit`（仅基线）；对改动文件跑 `npx eslint <files>`（含 rules-of-hooks 校验）；`pnpm build`
执行记录：（填写）

- [ ] **步骤 6：提交**

```bash
git add src/pages/resume/editor/components/forms src/lib/collaboration/richtext
git commit -m "feat(collab): wire all 9 rich-text editors to Yjs collaboration"
```

---

## 任务 9：全量校验 + 集成/浏览器验证

- [ ] **步骤 1：纯函数单测**

运行：`node --test --experimental-strip-types src/lib/collaboration/richtext/fragment-key.test.ts src/lib/collaboration/richtext/mirror-debounce.test.ts`（及任务 3 可选集成测试）
预期：全绿
执行记录：（填写）

- [ ] **步骤 2：类型检查**

运行：`npx tsc --noEmit`
预期：仅基线错误 `step-parsing.tsx TS6133`，无新增
执行记录：（填写）

- [ ] **步骤 3：Lint（新增/修改文件）**

运行：对本次改动文件跑 `npx eslint <files>`
预期：无错误（全量 `pnpm lint` 的预存问题不计）
执行记录：（填写）

- [ ] **步骤 4：生产构建**

运行：`pnpm build`
预期：成功
执行记录：（填写）

- [ ] **步骤 5：Yjs 合并集成测试（兜底浏览器不可用）**

新建 `src/lib/collaboration/richtext/yjs-merge.integration.test.ts`：用真实 `yjs` 两个 `Y.Doc` + `Y.XmlFragment`，模拟两 peer 对同一 fragment 并发编辑，`applyUpdate` 互相合并后断言两处编辑都保留（字符级无冲突）。
运行：`node --test --experimental-strip-types src/lib/collaboration/richtext/yjs-merge.integration.test.ts`
执行记录：（填写；若 strip-types 无法 import yjs 则改 `.mjs` 或注明并转浏览器）

- [ ] **步骤 6：浏览器双窗口验证（环境可用时）**

逐条对照 spec §7 复现清单：同字段字符级合并、远端彩色光标/选区+姓名、HTML 镜像 preview/刷新保留、协作关闭回落 standalone、种子化不重复。
执行记录：（逐条结果；环境不可用则注明限制，说明已由步骤 5 集成测试兜底 CRDT 合并语义）

- [ ] **步骤 7：最终提交（若有修复）**

```bash
git add -A && git commit -m "test(collab): verify Yjs rich-text collab merge + cleanup"
```

---

## 完成标准（对齐 spec §8）

- 两人同改同一富文本字段按字符合并、互不覆盖、均不丢输入。
- 编辑器内实时显示远端彩色光标/选区 + 姓名。
- HTML 镜像不回归：preview/PDF/历史/刷新一致。
- 协作关闭时富文本编辑器行为与现状一致（standalone、两处非简历用途不回归）。
- 会话反复开关不累积监听/频道（provider/doc/awareness 均销毁，去抖 flush）。
- 无新增类型错误、无构建错误。
