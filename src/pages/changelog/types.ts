import type { MDXContent } from 'mdx/types'

export interface ChangelogFrontmatter {
  title: string
  date: string
  tags?: string[]
  version?: string
  milestone?: boolean
  description?: string
}

export interface ChangelogEntry {
  frontmatter: ChangelogFrontmatter
  Content: MDXContent
}
