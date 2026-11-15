import type { ExperienceSourceRelation } from '@/lib/experience-sources/types'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import ReferenceTags from '../reference-tags'

export function SourceScopeSummary({
  sources,
}: {
  sources: ExperienceSourceRelation[]
}) {
  const reduced = useReducedMotion()

  if (!sources.length) return null

  return (
    <Collapsible className='max-w-full text-xs text-muted-foreground'>
      <CollapsibleTrigger asChild>
        <Button
          type='button'
          size='sm'
          variant='ghost'
          className='h-6 max-w-full gap-1 px-1 text-xs'
        >
          本轮资料 · {sources.length}
          <ChevronDown className='size-3' />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent
        className='overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down'
        style={reduced ? { animationDuration: '0s' } : undefined}
      >
        <div className='py-1'>
          <ReferenceTags
            references={sources.map((source) => ({
              type: 'reference',
              kind: 'experience',
              id: source.sourceId,
              versionId: source.versionId,
              label: source.name,
            }))}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
