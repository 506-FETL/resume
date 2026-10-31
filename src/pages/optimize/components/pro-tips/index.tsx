import { useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { ChevronDown, Lightbulb } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { DURATION } from '@/lib/motion'

const tips = [
  '使用简洁的层级和常见字体，避免用图片代替文字。',
  '复杂图形或双栏布局可能影响 ATS 解析。',
  '使用“工作经历”“教育背景”等常见章节标题。',
  '重要信息不要放在页眉页脚；导出 PDF 后检查排版是否完整。',
]

export default function ProTips({ embedded = false }: { embedded?: boolean }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const reduceMotion = useReducedMotion()

  return (
    <Collapsible
      open={!isMobile || open}
      onOpenChange={setOpen}
      className={embedded ? 'border-t pt-4' : 'border-t pt-5'}
    >
      {isMobile ? (
        <CollapsibleTrigger className='group flex w-full items-center gap-2 rounded-sm py-3 text-left text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
          <Lightbulb className='size-4 text-muted-foreground' />
          提高 ATS 可读性的建议
          <ChevronDown
            className='ml-auto size-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none'
            style={{
              transitionDuration: `${reduceMotion ? 0 : DURATION.base}s`,
            }}
          />
        </CollapsibleTrigger>
      ) : (
        <h2 className='flex items-center gap-2 pb-3 text-sm font-medium'>
          <Lightbulb className='size-4 text-muted-foreground' />
          提高 ATS 可读性的建议
        </h2>
      )}
      <CollapsibleContent
        style={{ animationDuration: `${reduceMotion ? 0 : DURATION.base}s` }}
      >
        <ul className='list-disc space-y-2 pl-4 text-sm leading-relaxed text-muted-foreground'>
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
