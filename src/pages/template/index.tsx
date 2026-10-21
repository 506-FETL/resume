import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import TemplateResourceStatus from '@/components/resume/template-resource-status'
import { DURATION, EASE } from '@/lib/motion'
import { useResumeTemplateStore } from '@/store/resume-template'
import PreviewDialog from './components/preview-dialog'
import TemplateCard from './components/template-card'
import { useTemplatePageStore } from './store.ts'

export default function Template() {
  const catalog = useResumeTemplateStore(state => state.catalog)
  const selectedTemplateId = useTemplatePageStore(state => state.selectedTemplateId)
  const previewItem = catalog.status === 'ready' ? catalog.data.find(item => item.templateId === selectedTemplateId) : undefined
  const load = useResumeTemplateStore(state => state.loadCatalog)
  const reduceMotion = useReducedMotion()
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    if (params.size)
      setParams({}, { replace: true })
  }, [params, setParams])
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 py-4">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">简历模板</h1>
        <p className="text-muted-foreground">选好排版，从完整示例开始，写出你的经历。</p>
      </header>
      {catalog.status === 'ready'
        ? <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{catalog.data.map(item => <TemplateCard key={item.templateId} item={item} />)}</motion.div>
        : <TemplateResourceStatus error={catalog.status === 'error' ? catalog.error.message : undefined} onRetry={() => { load(true) }} />}
      {previewItem && <PreviewDialog item={previewItem} />}
    </div>
  )
}
