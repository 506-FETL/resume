import type { ResumeTemplateBinding } from '@/lib/schema'
import { LayoutTemplate, RotateCw } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useEffect, useRef } from 'react'
import { inView, useIsPresent } from 'motion/react'
import AnimatedContent from '@/components/motion/animated-content'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DURATION } from '@/lib/motion'
import useResumeListStore from '../../store'

export default function TemplateBadge({
  binding,
}: {
  binding?: ResumeTemplateBinding | null
}) {
  const badgeRef = useRef<HTMLDivElement>(null)
  const present = useIsPresent()
  const reduceMotion = useReducedMotion()
  const templateId = binding?.templateId

  const resource = useResumeListStore((state) =>
    templateId ? state.templateNames[templateId] : undefined,
  )

  const loadName = useResumeListStore((state) => state.loadTemplateName)

  useEffect(() => {
    if (!present || !templateId || !badgeRef.current) return

    return inView(badgeRef.current, () => {
      loadName(templateId)
    })
  }, [templateId, loadName, present])

  const name = resource?.status === 'ready' ? resource.name : null

  const loading =
    Boolean(templateId) && (!resource || resource.status === 'loading')

  const label = !templateId ? '未设置模板' : (name ?? templateId)

  const title = binding
    ? `当前模板：${name ?? templateId} · v${binding.templateVersion}`
    : '简历尚未绑定有效模板'

  return (
    <div ref={badgeRef} className='min-w-0 max-w-full'>
      <AnimatedContent
        animationKey={`${templateId}:${label}:${loading ? 'loading' : resource?.status}`}
        className='min-h-5 min-w-0'
      >
        <div
          className='flex min-w-0 items-center gap-1'
          data-resume-template-tag={templateId ?? ''}
        >
          <Badge
            asChild
            variant='secondary'
            aria-label={title}
            className='max-w-full min-w-0 shrink transition-none'
          >
            <div>
              {loading ? (
                <div role='status'>
                  <span className='sr-only'>正在加载模板名称</span>
                  <Skeleton className='h-3 w-16' />
                </div>
              ) : (
                <>
                  <LayoutTemplate className='shrink-0' aria-hidden />
                  <span className='truncate'>{label}</span>
                </>
              )}
            </div>
          </Badge>
          {templateId && resource?.status === 'error' && (
            <button
              type='button'
              className='inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring'
              style={{
                transitionDuration: reduceMotion ? '0s' : `${DURATION.fast}s`,
              }}
              aria-label='重试加载模板名称'
              onClick={() => loadName(templateId, true)}
            >
              <RotateCw className='size-3' aria-hidden />
            </button>
          )}
        </div>
      </AnimatedContent>
    </div>
  )
}
