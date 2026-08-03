import type { MDXComponents } from 'mdx/types'
import type { ReactNode } from 'react'
import type { ChangelogEntry as ChangelogEntryType } from '../../types'
import { isValidElement } from 'react'

import { CodeBlock } from '@/components/ui/code-block'
import { formatDate } from '../../utils'

function MdxPre({ children }: { children?: ReactNode }) {
  if (!isValidElement<{ className?: string, children?: string }>(children)) {
    return <pre>{children}</pre>
  }

  const className = (children.props.className as string) ?? ''
  const language = className.replace('language-', '') || 'plaintext'
  const code = typeof children.props.children === 'string' ? children.props.children.trim() : ''

  return <CodeBlock language={language}>{code}</CodeBlock>
}

const mdxComponents: MDXComponents = { pre: MdxPre }

interface ChangelogEntryProps {
  entry: ChangelogEntryType
}

export function ChangelogEntry({ entry }: ChangelogEntryProps) {
  const { frontmatter, Content } = entry

  return (
    <div className="relative">
      <div className="flex flex-col md:flex-row gap-y-6">
        {/* 左侧：日期 + 版本 */}
        <div className="md:w-48 shrink-0">
          <div className="md:sticky md:top-16 pb-10">
            <time className="text-sm font-medium text-muted-foreground block mb-3">
              {formatDate(frontmatter.date)}
            </time>
            {frontmatter.version && (
              <div className="relative inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm font-bold leading-none text-foreground">
                {frontmatter.version}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：时间轴线 + 内容 */}
        <div className="flex-1 md:pl-8 relative pb-10">
          {/* 时间轴竖线 + 圆点 */}
          <div className="hidden md:block absolute top-2 left-0 w-px h-full bg-border">
            <div className="hidden md:block absolute -translate-x-1/2 size-3 bg-primary rounded-full " />
          </div>

          <div className="flex flex-col gap-6">
            <div className="relative  flex flex-col gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-balance">
                {frontmatter.title}
              </h2>

              {frontmatter.tags && frontmatter.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {frontmatter.tags.map(tag => (
                    <span
                      key={tag}
                      className="h-6 w-fit px-2 text-xs font-medium bg-muted text-muted-foreground rounded-full border flex items-center justify-center"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="prose dark:prose-invert max-w-none prose-headings:scroll-mt-8 prose-headings:font-semibold prose-a:no-underline prose-headings:tracking-tight prose-headings:text-balance prose-p:tracking-tight prose-p:text-balance">
              <Content components={mdxComponents} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
