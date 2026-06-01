---
name: page-organization
description: Use when creating or refactoring a page module in this repository, especially under src/pages, when deciding folder layout, file naming, shared page state, exports, or how to avoid prop drilling
---

# Page Organization

## Overview

This repository organizes page code by page module. New pages and large page refactors must follow the same shape as [`src/pages/history`](/Users/shemingcong/Downloads/resume/src/pages/history): predictable folders, page-scoped store, colocated components, and a small public surface.

## Required Layout

Create page modules with this baseline structure:

```text
src/pages/<page-name>/
  components/
    <feature-name>/
      index.tsx
      <child-component>.tsx
  hooks/
    use-<hook-name>.ts
  const.ts
  index.tsx
  store.ts
  types.ts
  utils.ts
```

## Rules

- Use [`src/pages/history`](/Users/shemingcong/Downloads/resume/src/pages/history) as the reference shape for new page modules.
- Keep page-scoped pure helpers in `utils.ts`.
- Keep page-scoped types in `types.ts`.
- Keep page-scoped constants, labels, options, and defaults in `const.ts`.
- Keep page-level shared state and action functions in `store.ts`.
- Put hooks that are reused in multiple places within the page in `hooks/`.
- Put view components in `components/`, grouped by feature area instead of dumping many loose files at the page root.
- Use `index.tsx` as the page entry and the component folder entry.

## Naming

- Use lowercase kebab-case for files and folders: `save-version-dialog.tsx`, `detail-panel`, `use-history-options.ts`.
- Do not introduce PascalCase file names for page files or page components.
- Each component group should live in its own folder and expose an `index.tsx`.

## Component Organization

- **Every component must be a folder**, even if it only contains a single file. Do not leave loose `.tsx` component files directly under `components/`. Always wrap them in a named folder with `index.tsx` as the entry point.
- Colocate private subcomponents, helper hooks, and related files inside the component folder.
- Prefer default exports for page components and component-folder entry files.
- Keep the public surface small: callers should usually import from the folder `index.tsx`, not deep internal files.
- The `index.tsx` of a component folder must export a **single assembled component** (default export) that composes its child components internally. Do **not** use `index.tsx` as a barrel of re-exports (e.g. `export { Foo } from './foo'`). The page entry should only need to import one component per feature folder.
- When moving a standalone file into a folder, preserve its original `@/` alias imports (e.g. `@/hooks/use-mobile`). Only convert sibling component imports to relative paths — never convert global alias imports to relative paths.

## Store vs Props

- Do not blindly prop drill.
- If a prop is passed through multiple intermediate components mainly for transport, stop and move it to the page store.
- If state or action functions are used across sibling branches or multiple nested layers, prefer the page store over repeated prop plumbing.
- Keep truly local UI-only state local; use the store for page-global shared variables and logic functions.

## Store Usage

- Use destructured calls: `const { foo, bar } = useStore()`.
- Do **not** use selector-style calls like `const foo = useStore(state => state.foo)`. Repeated selectors are verbose and harder to scan.
- When a store field needs a local alias, use destructuring rename: `const { manifestDraft: manifest } = useStore()`.
- Group all fields from the same store into a single destructure.

## Quick Check

Before finishing a new page or a major refactor, verify:

1. Does the page follow the history-style folder layout?
2. Are shared page variables and action functions in `store.ts` instead of deep props chains?
3. Are reusable page hooks under `hooks/`?
4. Are files and folders kebab-case?
5. Does each component folder expose a single `index.tsx` entry?
