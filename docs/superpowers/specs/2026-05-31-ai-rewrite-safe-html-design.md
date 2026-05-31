# AI Rewrite 安全 HTML 渲染设计

## 背景

`src/components/ai-rewrite/components/candidate-card.tsx` 使用 `dangerouslySetInnerHTML` 展示 LLM 返回的候选 HTML。LLM 输出不能直接信任，即使 prompt 要求返回合法 HTML，也应该在进入 React 渲染层前经过净化。

项目已经有 `src/lib/safe-html.ts`，该工具先调用 `DOMPurify.sanitize()`，再通过 `html-react-parser` 转成 React 节点。项目内简历 runtime、optimize 字段预览和代码块渲染已经复用这个工具。

## 目标

- 移除 AI rewrite 候选卡里的 `dangerouslySetInnerHTML`。
- 复用项目统一的 `parseSanitizedHtml()` 安全渲染路径。
- 不改变候选 HTML 的视觉容器样式。
- 不改变“应用此版本”的业务流程。

## 方案

在 `candidate-card.tsx` 中引入：

```ts
import { parseSanitizedHtml } from '@/lib/safe-html'
```

将：

```tsx
<div dangerouslySetInnerHTML={{ __html: candidate.html }} />
```

替换为：

```tsx
<div>{parseSanitizedHtml(candidate.html)}</div>
```

这样候选预览层不再直接信任 LLM HTML 字符串。

## 验证

- `! rg -n "dangerouslySetInnerHTML" src/components/ai-rewrite`
- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/eslint src/components/ai-rewrite --max-warnings=0`
