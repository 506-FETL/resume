import { createRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider, useTheme } from '@/components/theme-provider'
import { MotionProvider } from '@/components/motion/motion-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import TemplatePreviewDialog from '@/pages/template/components/preview-dialog'
import { useTemplatePageStore } from '@/pages/template/store'
import { useResumeTemplateStore } from '@/store/resume-template'
import useUserStore from '@/store/user'
import supabase from '@/lib/supabase/client'
import { catalogItemSchema } from '@/lib/resume-template/source/resource-schema'
import catalogRows from '../resume-workflow/creation/catalog.json'
import '@/index.css'

await supabase.auth.getSession()
useUserStore.getState().setCurrentUser(null)

const items = catalogRows.map((row) => catalogItemSchema.parse(row.metadata))

useResumeTemplateStore.setState({ catalog: { status: 'ready', data: items } })

interface Controls {
  getReducedMotion: () => boolean
  setReducedMotion: (value: boolean) => void
  cleanupDatabases: () => Promise<number>
}

function Fixture({ controls }: { controls: Controls }) {
  const [showTools, setShowTools] = useState(true)
  const [result, setResult] = useState('等待采样')
  const [reduced, setReduced] = useState(controls.getReducedMotion)
  const [dialog, setDialog] = useState<HTMLElement | null>(null)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDialog(document.querySelector('[data-slot="dialog-content"], [data-slot="drawer-popup"]'))
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  function sample(action: () => void) {
    const frames: unknown[] = []
    const start = performance.now()

    setResult('采样中')
    action()

    function tick() {
      const paper = document.querySelector<HTMLElement>('[data-catalog-preview-paper]')
      const background = document.querySelector<HTMLElement>('[data-catalog-background]')
      const popup = document.querySelector<HTMLElement>('[data-slot="dialog-content"], [data-slot="drawer-popup"]')
      const box = paper?.getBoundingClientRect()
      const form = document.querySelector<HTMLElement>('[data-catalog-creation-form]')

      frames.push({
        t: Math.round(performance.now() - start),
        formOpacity: form ? Number(getComputedStyle(form).opacity) : null,
        formTransform: form ? getComputedStyle(form).transform : null,
        paper: paper ? getComputedStyle(paper).transform : null,
        popup: popup ? getComputedStyle(popup).transform : null,
        background: background ? getComputedStyle(background).transform : null,
        size: box ? [box.width, box.height] : null,
        pages: paper?.querySelectorAll('[data-resume-page]').length,
        image: Boolean(paper?.querySelector('img')),
      })

      if (performance.now() - start < 6000) requestAnimationFrame(tick)
      else setResult(JSON.stringify(frames))
    }

    requestAnimationFrame(tick)
  }

  const tools = (
    <div data-fixture-controls style={{ position: 'absolute', bottom: 0, left: 0, zIndex: 80, display: 'flex', flexWrap: 'wrap', gap: 4, fontSize: 10 }}>
      <Button size='sm' onClick={() => sample(() => {})}>采样当前动画</Button>
      <Button size='sm' onClick={() => sample(() => {
        const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find((entry) => entry.textContent === '使用此模板')
        button?.click()
      })}>采样进入填写</Button>
      <Button size='sm' onClick={() => sample(() => {
        const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find((entry) => entry.textContent?.includes('返回预览'))
        button?.click()
      })}>采样返回预览</Button>
      <Button size='sm' onClick={() => sample(() => {
        useTemplatePageStore.getState().setPreviewOpen(false)
        setTimeout(() => useTemplatePageStore.getState().setPreviewOpen(true), 60)
      })}>采样关闭中重开</Button>
      <Button size='sm' onClick={() => sample(() => {
        useTemplatePageStore.getState().setPreviewStep('details')
        setTimeout(() => useTemplatePageStore.getState().setPreviewStep('preview'), 80)
      })}>采样快速往返</Button>
      <Button size='sm' onClick={() => {
        const next = !reduced
        controls.setReducedMotion(next)
        setReduced(next)
      }}>{reduced ? '关闭减少动效' : '开启减少动效'}</Button>
      <Button size='sm' onClick={() => setShowTools(false)}>隐藏验收操作</Button>
      <Button size='sm' onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>切换深浅色</Button>
    </div>
  )

  return (
    <div style={{ padding: 24 }}>
      <h1>模板预览动效验收</h1>
      <div style={{ display: 'flex', gap: 12 }}>
        {items.slice(0, 4).map((item) => (
          <Button key={item.templateId} onClick={(event) => sample(() => useTemplatePageStore.getState().showPreview(item.templateId, item.defaultExample, event.currentTarget))}>
            打开{item.name}
          </Button>
        ))}
        <Button onClick={async () => setResult(`已清理 ${await controls.cleanupDatabases()} 个隔离数据库`)}>清理验收数据</Button>
      </div>
      {showTools && (dialog ? createPortal(tools, dialog) : tools)}
      <output aria-hidden data-motion-results style={{ display: 'block', maxHeight: 250, overflow: 'auto', fontSize: 10 }}>{result}</output>
      <TemplatePreviewDialog />
    </div>
  )
}

export function mountFixture(controls: Controls) {
  createRoot(document.getElementById('root')!).render(
    <MemoryRouter>
      <ThemeProvider defaultTheme='light' storageKey='motion-test-theme'>
        <MotionProvider>
          <TooltipProvider><Fixture controls={controls} /></TooltipProvider>
        </MotionProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}
