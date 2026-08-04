import { Streamdown } from 'streamdown'

interface TextPartProps {
  text: string
}

// 助手文本按 markdown 渲染（复用仓库既有 Streamdown，支持流式增量）
export function TextPart({ text }: TextPartProps) {
  return (
    <div className="prose prose-sm prose-stone max-w-none dark:prose-invert prose-pre:my-2 prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5">
      <Streamdown>{text}</Streamdown>
    </div>
  )
}
