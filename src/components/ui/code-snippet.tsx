import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from '@/components/ui/code-block'
import { useHighlightedCode } from '@/hooks/use-highlighted-code'
import { cn } from '@/lib/utils'

export function CodeSnippet({
  children,
  language = 'plaintext',
  filename,
  showLineNumbers = false,
  className,
}: {
  children: string
  language?: string
  filename?: string
  showLineNumbers?: boolean
  className?: string
}) {
  const lines = useHighlightedCode(children, language)

  const download = () => {
    const extensions: Record<string, string> = {
      javascript: 'js',
      csharp: 'cs',
      ruby: 'rb',
      rust: 'rs',
      kotlin: 'kt',
      yaml: 'yaml',
      typescript: 'ts',
      python: 'py',
      markdown: 'md',
      bash: 'sh',
      shell: 'sh',
      plaintext: 'txt',
    }

    const url = URL.createObjectURL(
      new Blob([children], { type: 'text/plain' }),
    )

    const link = document.createElement('a')

    link.href = url
    link.download = filename ?? `code.${extensions[language] ?? language}`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <CodeBlock className={cn('not-prose my-2', className)}>
      <CodeBlockHeader>
        <CodeBlockTitle>{filename ?? language}</CodeBlockTitle>
        <CodeBlockActions>
          <Button
            type='button'
            variant='ghost'
            size='icon-xs'
            aria-label='下载代码'
            onClick={download}
          >
            <Download />
          </Button>
          <CodeBlockCopyButton type='button' value={children} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent lineNumbers={showLineNumbers}>
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}
