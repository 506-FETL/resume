import type { ResumeTemplateBinding } from '@/lib/schema'
import { LayoutTemplate, RotateCw } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import AnimatedContent from '@/components/motion/animated-content'
import { Badge } from '@/components/ui/badge'
import { DURATION } from '@/lib/motion'
import useResumeListStore from '../../store'

export default function TemplateBadge({
  binding,
}: {
  binding?: ResumeTemplateBinding | null
}) {
  const reduceMotion = useReducedMotion()
  const templateId = binding?.templateId
  const resource = useResumeListStore((state) =>
    templateId ? state.templateNames[templateId] : undefined,
  )
  const loadName = useResumeListStore((state) => state.loadTemplateName)
  useEffect(() => {
    if (templateId) loadName(templateId)
  }, [templateId, loadName])

  const name = resource?.status === 'ready' ? resource.name : null
  const loading =
    Boolean(templateId) && (!resource || resource.status === 'loading')
  const label = !templateId
    ? '未设置模板'
    : loading
      ? '模板加载中…'
      : (name ?? templateId)
  const title = binding
    ? `当前模板：${name ?? templateId} · v${binding.templateVersion}`
    : '简历尚未绑定有效模板'

  return (
    <AnimatedContent
      animationKey={`${templateId}:${label}:${resource?.status}`}
      className='min-h-5 min-w-0'
    >
      <div
        className='flex min-w-0 items-center gap-1'
        data-resume-template-tag={templateId ?? ''}
      >
        <Badge
          variant='secondary'
          title={title}
          className='max-w-full min-w-0 shrink text-muted-foreground transition-none'
        >
          <LayoutTemplate className='shrink-0' aria-hidden />
          <span className='truncate'>{label}</span>
        </Badge>
        {templateId && resource?.status === 'error' && (
          <button
            type='button'
            className='inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring'
            style={{
              transitionDuration: reduceMotion ? '0s' : `${DURATION.fast}s`,
            }}
            aria-label='重试加载模板名称'
            title='模板名称加载失败，点击重试'
            onClick={() => loadName(templateId, true)}
          >
            <RotateCw className='size-3' aria-hidden />
          </button>
        )}
      </div>
    </AnimatedContent>
  )
}
