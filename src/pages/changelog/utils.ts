import type { MDXContent } from 'mdx/types'
import type { ChangelogEntry, ChangelogFrontmatter } from './types'
import { formatDate } from '@/utils/date'

const modules = import.meta.glob('./content/*.mdx', { eager: true }) as Record<
  string,
  { default: MDXContent; frontmatter: ChangelogFrontmatter }
>

export function loadChangelogEntries(): ChangelogEntry[] {
  return Object.values(modules)
    .map((mod) => ({
      frontmatter: mod.frontmatter,
      Content: mod.default,
    }))
    .sort((a, b) => b.frontmatter.date.localeCompare(a.frontmatter.date))
}

export { formatDate }
