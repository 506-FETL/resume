import Markdown from 'react-markdown'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useReducedMotion } from '@/hooks/use-reduced-motion'

interface GenerationDetailsProps {
  reasoning: string
}

export function GenerationDetails({ reasoning }: GenerationDetailsProps) {
  const reduceMotion = useReducedMotion()

  if (!reasoning) return null

  return (
    <Accordion type='single' collapsible>
      <AccordionItem value='reasoning' className='border-t'>
        <AccordionTrigger className='py-3 text-xs text-muted-foreground'>
          查看处理过程
        </AccordionTrigger>
        <AccordionContent
          style={{ animationDuration: reduceMotion ? '0s' : undefined }}
          className='pb-2'
        >
          <div className='prose prose-sm dark:prose-invert max-w-none wrap-anywhere text-xs leading-relaxed text-muted-foreground [&_pre]:whitespace-pre-wrap [&_pre]:wrap-anywhere [&_pre]:bg-muted/50 [&_pre]:text-xs'>
            <Markdown>{reasoning}</Markdown>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
