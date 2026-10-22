import type { ExampleRef, TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { FileText } from 'lucide-react'
import { useInView } from 'motion/react'
import { useRef } from 'react'
import AnimatedContent from '@/components/motion/animated-content'
import { TEMPLATE_PREVIEW_ROOT_MARGIN } from '../../const'
import { useTemplatePreview } from '../../hooks/use-template-preview'

export default function CardPreview({ item, example }: { item: TemplateCatalogItem, example: ExampleRef }) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { margin: TEMPLATE_PREVIEW_ROOT_MARGIN })
  const preview = item.previews.find(candidate => candidate.templateId === item.templateId && candidate.templateVersion === item.currentVersion && candidate.example.exampleId === example.exampleId && candidate.example.version === example.version)
  const url = useTemplatePreview(preview, visible)
  return (
    <div ref={ref} className="aspect-[210/297]" aria-label={`${item.name}首页预览`}>
      <AnimatedContent animationKey={url ?? 'placeholder'}>
        {url
          ? <img src={url} alt={`${item.name}首页静态预览`} width={preview?.asset.width} height={preview?.asset.height} className="aspect-[210/297] w-full object-cover object-top" />
          : (
              <div className="flex aspect-[210/297] flex-col items-center justify-center gap-3 bg-muted/20 px-5 text-center">
                <FileText aria-hidden className="size-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">点击查看完整预览</p>
              </div>
            )}
      </AnimatedContent>
    </div>
  )
}
