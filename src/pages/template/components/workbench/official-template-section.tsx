import { ArrowRight, Pencil } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { DURATION, EASE, SPRING } from '@/lib/motion'
import { TEMPLATE_CENTER_TAB_META } from '../../const'
import { useOfficialTemplatesStore, useTemplateWorkbenchStore } from '../../store'
import { TemplateCard } from './template-card'
import { TemplateThumbnail } from './template-thumbnail'

export function OfficialTemplateSection() {
  const reduceMotion = useReducedMotion()
  const { officialTemplates: templates } = useOfficialTemplatesStore()
  const { createResumeWithTemplate, customizeOfficialTemplate } = useTemplateWorkbenchStore()
  const sectionMeta = TEMPLATE_CENTER_TAB_META.official

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{`${templates.length} 个模板`}</Badge>
          <Badge variant="outline">可直接使用</Badge>
          <Badge variant="outline">支持自定义</Badge>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{sectionMeta.description}</p>
      </div>

      <Separator />

      <div className="grid gap-5 grid-cols-1 md:grid-cols-3 lg:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {templates.map((template, index) => (
            <motion.div
              key={template.id}
              layout={reduceMotion ? false : 'position'}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{
                opacity: 0,
                scale: reduceMotion ? 1 : 0.98,
                y: 0,
                transition: { duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.in, delay: 0 },
              }}
              transition={{
                duration: reduceMotion ? 0 : DURATION.base,
                ease: EASE.out,
                delay: reduceMotion ? 0 : Math.min(index, 8) * 0.03,
                layout: reduceMotion ? { duration: 0 } : SPRING.layout,
              }}
            >
              <TemplateCard
                preview={<TemplateThumbnail manifest={template.manifest} />}
                tags={(
                  <>
                    <Badge variant="secondary">{template.layoutLabel}</Badge>
                    {template.styleLabels.map(label => (
                      <Badge key={label} variant="outline">{label}</Badge>
                    ))}
                  </>
                )}
                hoverActions={[
                  {
                    label: '直接使用',
                    onClick: () => createResumeWithTemplate('official', template.id),
                    icon: ArrowRight,
                  },
                  {
                    label: '自定义',
                    onClick: () => customizeOfficialTemplate(template.id),
                    variant: 'outline',
                    icon: Pencil,
                  },
                ]}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
