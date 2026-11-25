// 直接在 glob 上取键，让 Vite 只生成文件名，导航无需为正文生成动态入口。
const entries = Object.keys(
  import.meta.glob('/src/pages/changelog/content/*.mdx'),
)

export const LATEST_CHANGELOG_ENTRY = entries.sort().at(-1) ?? ''
