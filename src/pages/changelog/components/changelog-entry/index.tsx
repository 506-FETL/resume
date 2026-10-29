import type { MDXComponents } from 'mdx/types'
import type { ReactNode } from 'react'
import type { ChangelogEntry as ChangelogEntryType } from '../../types'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { isValidElement } from 'react'
import { CodeBlock } from '@/components/ui/code-block'
import { DURATION, EASE } from '@/lib/motion'
import { formatDate } from '../../utils'

function MdxPre({ children }: { children?: ReactNode }) {
  if (!isValidElement<{ className?: string; children?: string }>(children)) {
    return <pre>{children}</pre>
  }

  const className = (children.props.className as string) ?? ''
  const language = className.replace('language-', '') || 'plaintext'

  const code =
    typeof children.props.children === 'string'
      ? children.props.children.trim()
      : ''

  return <CodeBlock language={language}>{code}</CodeBlock>
}

const mdxComponents: MDXComponents = { pre: MdxPre }

interface ChangelogEntryProps {
  entry: ChangelogEntryType
}

export function ChangelogEntry({ entry }: ChangelogEntryProps) {
  const { frontmatter, Content } = entry
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className='relative'
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{
        duration: reduceMotion ? 0 : DURATION.base,
        ease: EASE.out,
      }}
    >
      <div className='flex flex-col gap-y-3 md:flex-row'>
        {/* 左侧：日期 + 版本 */}
        <div className='shrink-0 md:w-36'>
          <div className='flex items-center gap-3 md:sticky md:top-16 md:block md:pb-10'>
            <time
              dateTime={frontmatter.date}
              className='block text-sm font-medium text-muted-foreground md:mb-2'
            >
              {formatDate(frontmatter.date)}
            </time>
            {frontmatter.version && (
              <div className='inline-flex items-center text-xs font-medium text-muted-foreground'>
                {frontmatter.version}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：时间轴线 + 内容 */}
        <div className='relative min-w-0 flex-1 pb-10 md:pl-7'>
          {/* 时间轴竖线 + 圆点 */}
          <div className='hidden md:block absolute top-2 left-0 w-px h-full bg-border'>
            <div className='hidden md:block absolute -translate-x-1/2 size-2 bg-muted-foreground rounded-full ' />
          </div>

          <div className='flex flex-col gap-5'>
            <div className='relative flex flex-col gap-2'>
              <h2 className='text-xl font-semibold tracking-tight text-balance'>
                {frontmatter.title}
              </h2>

              {frontmatter.tags && frontmatter.tags.length > 0 && (
                <div className='flex flex-wrap gap-x-3 gap-y-1'>
                  {frontmatter.tags.map((tag) => (
                    <span key={tag} className='text-xs text-muted-foreground'>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className='prose dark:prose-invert max-w-none prose-headings:scroll-mt-8 prose-headings:font-semibold prose-a:no-underline prose-headings:tracking-tight prose-headings:text-balance prose-p:tracking-tight prose-p:text-balance'>
              <Content components={mdxComponents} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
