import type { MDXContent } from 'mdx/types'
import type { ChangelogEntry, ChangelogFrontmatter } from './types'
import { formatDate } from '@/utils/date'

const modules = import.meta.glob('./content/*.mdx', { eager: true }) as Record<
  string,
  {
    default: MDXContent
    frontmatter: ChangelogFrontmatter
    metadata?: ChangelogFrontmatter
  }
>

export function loadChangelogEntries(): ChangelogEntry[] {
  return Object.values(modules)
    .map((mod) => ({
      // frontmatter 由 MDX 插件生成；发布封面与加载态共用轻量 metadata。
      frontmatter: mod.metadata ?? mod.frontmatter,
      Content: mod.default,
    }))
    .sort((a, b) => b.frontmatter.date.localeCompare(a.frontmatter.date))
}

export { formatDate }
