import type { ComponentProps, ReactNode } from 'react'
import { isValidElement } from 'react'
import { Streamdown } from 'streamdown'
import { CodeBlock } from '@/components/ui/code-block'

interface TextPartProps {
  text: string
}

// 从 markdown 的 <pre><code class="language-xxx">...</code></pre> 结构里取出语言与源码
function extractCode(children: ReactNode): { code: string, language: string } {
  const codeEl = Array.isArray(children) ? children[0] : children
  if (!isValidElement(codeEl))
    return { code: '', language: 'plaintext' }

  const props = codeEl.props as { className?: string, children?: ReactNode }
  const match = /language-(\w+)/.exec(props.className ?? '')
  const language = match?.[1] ?? 'plaintext'

  const raw = props.children
  const code = typeof raw === 'string'
    ? raw
    : Array.isArray(raw)
      ? raw.filter(part => typeof part === 'string').join('')
      : String(raw ?? '')

  return { code: code.replace(/\n$/, ''), language }
}

function CodeBlockPre({ children }: ComponentProps<'pre'>) {
  const { code, language } = extractCode(children)
  return (
    <CodeBlock language={language} showLineNumbers>
      {code}
    </CodeBlock>
  )
}

// Streamdown 的 components 索引签名较宽，用局部映射满足类型
const MARKDOWN_COMPONENTS = { pre: CodeBlockPre } as ComponentProps<typeof Streamdown>['components']

// 助手文本按 markdown 渲染（复用仓库既有 Streamdown，支持流式增量）。
// 代码块改用仓库 CodeBlock：带语言图标、语法高亮与复制/下载。
export function TextPart({ text }: TextPartProps) {
  return (
    <div className="prose prose-sm prose-stone max-w-none dark:prose-invert prose-pre:my-2 prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5">
      <Streamdown components={MARKDOWN_COMPONENTS}>
        {text}
      </Streamdown>
    </div>
  )
}
