# 富文本输入触发预览缺失字段崩溃修复设计

## 背景

简历编辑器中的 Tiptap 富文本字段在输入后会触发表单状态写回与简历预览重渲染。当前生产报错为：

```text
TypeError: Cannot read properties of undefined (reading 'length')
at honors_certificates
```

源码对应 `HonorsCertificatesRenderer` 对 `honors_certificates.certificates.length` 的直接读取。同类渲染器还会直接读取 `skill_specialty.skills.length`、`hobbies.hobbies.length`，经历模块也依赖 `items` 为数组。

## 根因

问题由两个数据边界共同造成：

1. `useResumeFormSync` 使用 React Hook Form 的 `watch(callback)` 返回值作为完整 section 写回 Zustand。该回调值的类型允许字段缺失，但现有代码通过类型断言把它当成完整 `FormDataMap`，随后整段替换 section；一旦回调值不完整，同级数组字段会被丢弃。
2. `mapSourceToPersistedSnapshot` 仅在整个 section 缺失时使用默认值，不会补齐 section 内部缺失或为 `null` 的结构字段。旧简历或已受影响的 Automerge 文档因此可能长期保留缺少 `certificates`、`skills`、`hobbies` 或 `items` 的对象。

Tiptap 输入本身不是异常来源；它只是触发了状态写回和预览重渲染，使不完整数据在 renderer 中暴露。

## 目标

- 任意富文本字段输入后，不得丢失同一 section 的其他字段。
- 旧简历中缺失或为 `null` 的结构字段在读取时自动补齐。
- 所有简历预览入口都能安全消费旧数据，不再因读取数组的 `.length`、`.map` 或 `.filter` 崩溃。
- 保留已有合法数据和数组内容，不改变正常简历的展示与编辑行为。

## 非目标

- 不修改 Tiptap 的工具栏、样式或协作编辑协议。
- 不执行数据库或 Automerge 文档的批量离线迁移。
- 不在各个 renderer 中散落可选链作为主要修复方式。
- 不重构无关的简历表单、模板运行时或持久化架构。

## 方案比较

### 方案 A：完整表单订阅 + 共享结构规范化（采用）

表单写路径只消费 React Hook Form 明确提供的完整 `values`；读路径使用共享规范化函数按默认 section 结构补齐缺失容器。该方案同时阻止新数据损坏并兼容既有坏数据，修复点位于数据边界，影响范围可控。

### 方案 B：renderer 局部兜底

将访问改为 `certificates?.length`、`skills ?? []`。改动最小，但坏数据仍会在 store、同步和持久化链路中传播，而且容易遗漏其他数组读取点，因此不采用。

### 方案 C：数据库与 Automerge 全量迁移

主动扫描并重写所有历史记录。能够永久清洗现存数据，但需要额外的数据迁移、回滚和协作冲突处理，明显超出本次线上崩溃修复范围，因此不采用。

## 详细设计

### 1. 表单写入边界

`useResumeFormSync` 改用 React Hook Form 的完整值订阅接口。每次本地表单变化时：

1. 从订阅事件取得完整 section 值。
2. 读取 Zustand 中当前 section 作为 diff 基线。
3. 用现有 `planRemoteFormSync` 和 `buildWriteOps` 生成字段级 Automerge 操作。
4. 将完整 section 用于乐观 Zustand 更新，将字段级操作用于 Automerge 更新。

远端同步期间继续受 `isResettingRef` 抑制，避免远端写入形成回环。现有字段级 CRDT 合并策略不变。

### 2. 结构规范化边界

新增共享的、无副作用的结构规范化函数。它按默认值的形状递归处理数据：

- 默认值为数组时：输入也是数组则完整保留；输入缺失、为 `null` 或不是数组时使用默认数组的副本。
- 默认值为普通对象时：递归补齐输入对象缺失的键；输入不是普通对象时使用默认对象的副本。
- 标量字段存在时保留原值；缺失或为 `null` 时回落到默认值。
- 不按索引合并数组，也不修改合法数组项，避免意外覆盖用户数据。
- 返回新对象，不能修改共享的 `DEFAULT_*` 常量或调用方输入。

该规范化至少应用于：

- `mapSourceToPersistedSnapshot`：保证编辑器加载到 Zustand 的表单 section 结构完整。
- `buildTemplateResumeData`：作为共享预览边界，保护编辑器、历史版本、职位追踪和模板预览等调用方。

读时规范化已经能立即修复用户体验；后续正常保存会写出完整快照。本次不在加载阶段主动整段覆盖 Automerge 文档，以避免制造不必要的协作冲突。

### 3. 错误处理

- 对缺失、`null` 或容器类型错误的数据静默回落到默认结构，因为这些记录属于可兼容的旧数据。
- 不吞掉表单同步或 Automerge 更新抛出的现有错误；现有 `syncError` 行为保持不变。
- 不把数据问题转化成 renderer 级异常，也不向用户展示无意义的技术错误提示。

## 验证策略

本次按用户要求不采用 TDD，不要求测试先行。实现完成后通过以下场景和工程检查验证修复：

1. 缺少 `honors_certificates.certificates` 时补齐为空数组，同时保留 `description`。
2. `skill_specialty.skills`、`hobbies.hobbies` 和经历 `items` 为缺失或 `null` 时补齐为空数组。
3. 合法的非空数组、对象和富文本字符串原样保留，输入和默认常量均不被修改。
4. 富文本描述变化时，完整 section 生成的写操作只包含描述字段，不删除或覆盖同级数组。
5. 运行针对原始报错的数据回归验证、定向 ESLint、`npx tsc --noEmit` 和生产构建；不为本次修复额外引入测试框架。

## 验收标准

- 在技能特长、荣誉证书、兴趣爱好、自我评价及各经历富文本中输入内容均不再触发 `.length` 报错。
- 缺少数组字段的旧简历能够正常打开、编辑和预览。
- 编辑富文本后，同 section 已有标签或经历列表保持不变。
- 正常结构的简历渲染结果无变化。
- 原始报错场景回归验证、类型检查、定向 lint 与构建通过。
