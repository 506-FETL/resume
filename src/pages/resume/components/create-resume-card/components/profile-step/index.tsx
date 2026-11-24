import { Button } from '@/components/ui/button'
import { PROFILE_GUIDES } from '@/lib/resume-preparation/const'
import type { ResumeProfile } from '@/lib/resume-preparation/types'
import { cn } from '@/lib/utils'
import { useCreationDraftStore } from '../../store'

export function CreationProfile() {
  const draft = useCreationDraftStore((state) => state.draft)
  const patch = useCreationDraftStore((state) => state.patch)

  return (
    <div className='space-y-3'>
      {(
        Object.entries(PROFILE_GUIDES) as [
          ResumeProfile,
          (typeof PROFILE_GUIDES)[ResumeProfile],
        ][]
      ).map(([key, guide]) => (
        <Button
          variant='outline'
          type='button'
          key={key}
          disabled={Boolean(draft.creation)}
          aria-pressed={draft.profile === key}
          onClick={() => patch({ profile: key })}
          className={cn(
            'block h-auto w-full rounded-lg p-4 text-left whitespace-normal shadow-none transition-colors motion-reduce:transition-none',
            draft.profile === key
              ? 'border-primary bg-muted/50'
              : 'hover:bg-muted/30',
          )}
        >
          <span className='block text-sm font-medium'>{guide.label}</span>
          <span className='mt-1 block text-xs leading-5 text-muted-foreground'></span>
        </Button>
      ))}
    </div>
  )
}
