import type { ComponentProps, ReactNode } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { createContext, isValidElement, memo, use } from 'react'
import { Streamdown, defaultRehypePlugins } from 'streamdown'
import { Button } from '@/components/ui/button'
import 'streamdown/styles.css'
import { CodeSnippet } from '@/components/ui/code-snippet'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DURATION, EASE } from '@/lib/motion'
import { z } from 'zod'
import {
  citationLabel,
  resolveCitationEvidence,
  type CitationEvidence,
} from '@/lib/ai/agent/citation-evidence'
import { useSourceMetadata } from '@/features/experience-sources/use-source-metadata'
import useAssistantStore from '../../../store'
import type { TextPartProps } from './types'

const citationSchema = z.object({
  sourceId: z.string().uuid(),
  versionId: z.string().uuid(),
  blockId: z.string().min(1).max(120),
  quote: z.string().min(1).max(2400).optional(),
})

// 从 markdown 的 <pre><code class="language-xxx">...</code></pre> 结构里取出语言与源码
function extractCode(children: ReactNode): { code: string; language: string } {
  const codeEl = Array.isArray(children) ? children[0] : children

  if (!isValidElement(codeEl)) return { code: '', language: 'plaintext' }

  const props = codeEl.props as { className?: string; children?: ReactNode }
  const match = /language-(\w+)/.exec(props.className ?? '')
  const language = match?.[1] ?? 'plaintext'

  const raw = props.children

  const code =
    typeof raw === 'string'
      ? raw
      : Array.isArray(raw)
        ? raw.filter((part) => typeof part === 'string').join('')
        : String(raw ?? '')

  return { code: code.replace(/\n$/, ''), language }
}

function CodeBlockPre({ children }: ComponentProps<'pre'>) {
  const { code, language } = extractCode(children)

  return (
    <CodeSnippet language={language} showLineNumbers>
      {code}
    </CodeSnippet>
  )
}

// Streamdown 的 components 索引签名较宽，用局部映射满足类型
type CitationNode = {
  tagName?: string
  properties?: Record<string, unknown>
  children?: CitationNode[]
  value?: string
}

const CitationEvidenceContext = createContext<CitationEvidence[]>([])

function experienceCitations() {
  return (tree: CitationNode) => {
    const visit = (node: CitationNode) => {
      const href = node.properties?.href

      if (node.tagName === 'a' && typeof href === 'string') {
        let url: URL | undefined

        try {
          url = new URL(href, window.location.href)
        } catch {
          /* 无效链接继续交给 Markdown 渲染器。 */
        }

        if (
          url?.origin === window.location.origin &&
          url.pathname === '/experience'
        ) {
          const parsed = citationSchema.safeParse(
            Object.fromEntries(url.searchParams),
          )

          if (parsed.success) {
            node.tagName = 'experience-citation'
            node.properties = { href, ...parsed.data }
          } else if (
            ['sourceId', 'versionId', 'blockId'].some((key) =>
              url.searchParams.has(key),
            )
          ) {
            node.tagName = 'span'
            node.properties = { title: '来源暂不可定位' }
            node.children = [
              { value: '来源暂不可定位', type: 'text' } as CitationNode,
            ]
          }
        }
      }

      node.children?.forEach(visit)
    }

    visit(tree)
  }
}

function linkText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(linkText).join('')
  if (isValidElement<{ children?: ReactNode }>(node))
    return linkText(node.props.children)

  return ''
}

function ExperienceCitation(props: Record<string, unknown>) {
  const { href, children, sourceId, versionId, blockId, quote } =
    props as unknown as ComponentProps<'a'> & z.infer<typeof citationSchema>

  const evidence = use(CitationEvidenceContext)

  const source = resolveCitationEvidence(
    evidence,
    { sourceId, versionId, blockId, quote },
    linkText(children),
  )

  const metadata = useSourceMetadata(source ? [sourceId] : [])[sourceId]

  if (!source) return <span>来源暂不可定位</span>
  if (metadata?.status === 'missing')
    return <span>{citationLabel(source)} · 已删除</span>
  if (metadata?.status === 'ready' && metadata.source.status !== 'ready')
    return <span>{citationLabel(source)} · 暂不可用</span>

  return (
    <Button
      variant='link'
      asChild
      className='inline h-auto whitespace-normal p-0 align-baseline text-current underline'
    >
      <a
        href={href}
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return

          event.preventDefault()

          useAssistantStore.getState().openSourceViewer(
            {
              sourceId,
              versionId,
              blockId,
              name: source.name,
            },
            event.currentTarget,
          )
        }}
      >
        {citationLabel(source)}
      </a>
    </Button>
  )
}

const MARKDOWN_COMPONENTS = {
  pre: CodeBlockPre,
  table: ({ children }: ComponentProps<'table'>) => (
    <div className='not-prose my-3'>
      <Table>{children}</Table>
    </div>
  ),
  thead: ({ children }: ComponentProps<'thead'>) => (
    <TableHeader>{children}</TableHeader>
  ),
  tbody: ({ children }: ComponentProps<'tbody'>) => (
    <TableBody>{children}</TableBody>
  ),
  tfoot: ({ children }: ComponentProps<'tfoot'>) => (
    <TableFooter>{children}</TableFooter>
  ),
  tr: ({ children }: ComponentProps<'tr'>) => <TableRow>{children}</TableRow>,
  th: ({ children, style }: ComponentProps<'th'>) => (
    <TableHead className='whitespace-normal' style={style}>
      {children}
    </TableHead>
  ),
  td: ({ children, style }: ComponentProps<'td'>) => (
    <TableCell className='min-w-24 whitespace-normal break-words' style={style}>
      {children}
    </TableCell>
  ),
  caption: ({ children }: ComponentProps<'caption'>) => (
    <TableCaption>{children}</TableCaption>
  ),
  'experience-citation': ExperienceCitation,
} as ComponentProps<typeof Streamdown>['components']

const REHYPE_PLUGINS = [
  ...Object.values(defaultRehypePlugins),
  experienceCitations,
] as ComponentProps<typeof Streamdown>['rehypePlugins']

const STREAM_ANIMATION = {
  animation: 'fadeIn',
  duration: DURATION.base * 1000,
  easing: `cubic-bezier(${EASE.out.join(',')})`,
} as const

// 助手文本按 markdown 渲染（复用仓库既有 Streamdown，支持流式增量）。
// 代码块组合官方 CodeBlock 原语，保留增量高亮、复制与下载。
const TextContent = memo(function TextContent({
  text,
  animate = false,
  evidence = [],
}: TextPartProps) {
  const reduceMotion = useReducedMotion()

  return (
    <CitationEvidenceContext value={evidence}>
      <div
        data-assistant-text-ready
        className='prose prose-sm prose-stone max-w-none dark:prose-invert prose-pre:my-2 prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5'
      >
        <Streamdown
          components={MARKDOWN_COMPONENTS}
          controls={{ table: false }}
          rehypePlugins={REHYPE_PLUGINS}
          mode={animate ? 'streaming' : 'static'}
          isAnimating={animate}
          animated={reduceMotion ? false : STREAM_ANIMATION}
        >
          {text}
        </Streamdown>
      </div>
    </CitationEvidenceContext>
  )
})

export default TextContent
