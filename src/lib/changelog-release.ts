// 只读取文件名；导航不执行这些加载函数，不提前下载更新日志正文。
const entries = import.meta.glob('/src/pages/changelog/content/*.mdx')

export const LATEST_CHANGELOG_ENTRY = Object.keys(entries).sort().at(-1) ?? ''
