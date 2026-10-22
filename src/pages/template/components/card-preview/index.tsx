import type { ExampleRef, TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { useInView } from 'motion/react'
import { useRef } from 'react'
import AnimatedContent from '@/components/motion/animated-content'
import { exampleKey } from '@/lib/resume-template/source/types'
import { TEMPLATE_PREVIEW_ROOT_MARGIN } from '../../const'
import ExamplePreview from '../example-preview'

export default function CardPreview({ item, example }: { item: TemplateCatalogItem, example: ExampleRef }) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { margin: TEMPLATE_PREVIEW_ROOT_MARGIN })
  return (
    <div ref={ref} className="aspect-[210/297]" aria-label={`${item.name}首页预览`}>
      <AnimatedContent animationKey={visible ? exampleKey(example) : 'offscreen'}>
        {visible ? <ExamplePreview item={item} example={example} /> : <div className="aspect-[210/297] bg-muted/20" />}
      </AnimatedContent>
    </div>
  )
}
