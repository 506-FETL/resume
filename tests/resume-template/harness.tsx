/* eslint-disable antfu/no-top-level-await, react-refresh/only-export-components */
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import { StrictMode, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import CanonicalPagedDocument from '@/components/resume/pagination/canonical-paged-document'
import { useResumePrint } from '@/components/resume/pagination/use-resume-print'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { ResumeTemplateRuntime } from '@/components/resume/runtime/ResumeTemplateRuntime'
import TemplateResourceStatus from '@/components/resume/template-resource-status'
import { useResolvedResumeTemplate } from '@/hooks/use-resolved-resume-template'
import { parseTemplateDefinition } from '@/lib/resume-template/definition-schema'
import { getFontFamilyCSS } from '@/lib/schema'
import { createResumeDocHtml } from '@/store/resume/helpers/doc-html'
import '@fontsource-variable/arimo/wght.css'
import '@fontsource-variable/noto-sans-sc/wght.css'
import '@fontsource-variable/noto-serif-sc/wght.css'
import '@/index.css'

const query = new URLSearchParams(location.search)
const template = query.get('template') || 'default'
const example = query.get('example') || 'frontend'
const definition = parseTemplateDefinition(await (await fetch(`/template-resources/${template}/v2.json`)).json())
const fixture = await (await fetch(`/template-resources/examples/${example}/v1.json`)).json()
const initial = { ...fixture.content, ...definition.appearanceDefaults, type: 'default', templateBinding: { source: 'official', templateId: definition.templateId, templateVersion: definition.version } }
if (query.has('font'))
  initial.font.fontFamily = query.get('font')
if (query.has('margin'))
  initial.spacing.pageMargin = Number(query.get('margin'))
if (query.has('size'))
  initial.font.fontSize = Number(query.get('size'))
if (query.get('mode') === 'long') {
  initial.visibility.work_experience = false
  initial.work_experience.items = Array.from({ length: 18 }, (_, i) => ({ ...fixture.content.work_experience.items[0], entryId: `long-${i}`, companyName: `第${i + 1}段长内容经历`, workInfo: `<p>验收长内容第${i + 1}项。通过不同长度的中文、English、数字123和换行验证正文完整性。</p>`.repeat(4) }))
  initial.self_evaluation.content = '<p>多页末尾唯一标记 END-DECLARATIVE-2026</p>'
}
if (query.get('mode') === 'boundary') {
  initial.order = ['basics', 'self_evaluation']
  initial.self_evaluation.content = Array.from({ length: Number(query.get('count') || 30) }, (_, i) => `<p>临界行 ${i + 1} —— 完整文字不得被分页裁切。</p>`).join('')
}
function Harness() {
  const [snapshot, setSnapshot] = useState(initial)
  const [templateDefinition, setTemplateDefinition] = useState(definition)
  const data = useMemo(() => buildTemplateResumeData(snapshot), [snapshot])
  const appearance = useMemo(() => ({ font: snapshot.font, spacing: snapshot.spacing, theme: snapshot.theme }), [snapshot])
  const [state, setState] = useState<ResumeDocumentState>({ status: 'measuring', signature: null, fontFamily: '', fontWeights: [], error: null })
  const resolved = useResolvedResumeTemplate({ definition: templateDefinition })
  const resourceError = resolved.resource.status === 'error' ? resolved.resource.error.message : null
  useLayoutEffect(() => {
    if (resolved.resource.status !== 'ready')
      setState({ status: resourceError ? 'error' : 'measuring', signature: null, fontFamily: '', fontWeights: [], error: resourceError })
  }, [resolved.resource.status, resourceError])
  const documentRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef<HTMLDivElement>(null)
  const print = useResumePrint({ contentRef: documentRef, documentState: state, documentTitle: 'declarative-template-verification' })
  Object.assign(window, { resumeFixture: snapshot, resumeDefinition: templateDefinition, resumeState: state, setResumeFixture: setSnapshot, setResumeDefinition: setTemplateDefinition, exportWord: () => createResumeDocHtml(sourceRef.current!.innerHTML, { fontFamily: getFontFamilyCSS(snapshot.font.fontFamily), baseFontSize: snapshot.font.fontSize, lineHeight: snapshot.spacing.lineHeight, pageMargin: snapshot.spacing.pageMargin, badgeBackground: '#eeeeee', textPrimary: '#111111' }) })
  return (
    <>
      <div style={{ padding: 12 }}>
        <button id="print" onClick={() => print()}>通过正式打印入口导出 PDF</button>
        <output id="state">
          {state.status}
          :
          {' '}
          {state.error}
        </output>
      </div>
      {resolved.resource.status !== 'ready' ? <div data-edge-asset-gate><TemplateResourceStatus error={resourceError ?? undefined} onRetry={resolved.retry} /></div> : <CanonicalPagedDocument appearance={appearance} contentVersion={JSON.stringify([snapshot, templateDefinition])} documentRef={documentRef} sourceRef={sourceRef} onStateChange={setState}><ResumeTemplateRuntime data={data} definition={resolved.resource.data} assetUrls={resolved.assetUrls} appearance={appearance} projectionReferenceDate={fixture.projectionReferenceDate} /></CanonicalPagedDocument>}
      <Toaster />
    </>
  )
}
createRoot(document.getElementById('root')!).render(query.has('strict') ? <StrictMode><Harness /></StrictMode> : <Harness />)
