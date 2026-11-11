import { createRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider, useTheme } from '@/components/theme-provider'
import { MotionProvider } from '@/components/motion/motion-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import CreateResumeCard from '@/pages/resume/components/create-resume-card'
import { useCreationDraftStore } from '@/pages/resume/components/create-resume-card/store'
import { useCreationFlow } from '@/pages/resume/components/create-resume-card/hooks/use-creation-flow'
import { emptyDraft } from '@/pages/resume/components/create-resume-card/utils'
import useUserStore from '@/store/user'
import { useResumeCreationStore } from '@/store/resume-creation'
import supabase from '@/lib/supabase/client'
import {
  installPersistenceProbe,
  insertCalls,
  savedSnapshots,
  simulateUnknownResult,
} from './persistence'
import { importText, verifyCreationFlow } from './verify-flow'
import { preparePreviewScenario, type PreviewScenario } from './resource-probe'
import catalogRows from './catalog.json'
import { catalogItemSchema } from '@/lib/resume-template/source/resource-schema'
import '@/index.css'

const { default: AnimationSampler }: typeof import('./animation-sampler') =
  await import(
    /* @vite-ignore */ new URL(
      './animation-sampler.tsx?revision=5',
      import.meta.url,
    ).href
  )

await supabase.auth.getSession()
useUserStore.getState().setCurrentUser(null)
installPersistenceProbe()

interface Controls {
  getReducedMotion: () => boolean
  setReducedMotion: (value: boolean) => void
  cleanupDatabases: () => Promise<number>
}

function Fixture({ controls }: { controls: Controls }) {
  const [open, setOpen] = useState(false)
  const [reduced, setReduced] = useState(controls.getReducedMotion)
  const [dialog, setDialog] = useState<HTMLElement | null>(null)
  const [results, setResults] = useState<string[]>([])
  const [running, setRunning] = useState(false)

  const [message, setMessage] = useState(
    '所有创建仅写入本标签页隔离的 IndexedDB。',
  )

  const [, refresh] = useState(0)
  const { theme, setTheme } = useTheme()
  const status = useResumeCreationStore((state) => state.status)

  const flow = useCreationFlow({
    open: false,
    online: false,
    onClose: () => {},
    onCreated: () => refresh((value) => value + 1),
  })

  useEffect(() => {
    const observer = new MutationObserver(() =>
      setDialog(
        document.querySelector<HTMLElement>(
          '[data-slot=dialog-content], [data-slot=drawer-content]',
        ),
      ),
    )

    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  function toggleReduced() {
    const value = !reduced

    controls.setReducedMotion(value)
    setReduced(value)
  }

  async function runChecks() {
    setRunning(true)
    setResults([])

    try {
      setResults(await verifyCreationFlow(flow.create))
      setMessage('全部数据边界检查通过。')
    } catch (error) {
      setMessage(
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      )
    } finally {
      setRunning(false)
    }
  }

  async function restore(scenario: PreviewScenario) {
    const item = catalogItemSchema.parse(catalogRows.at(-1)!.metadata)

    await useCreationDraftStore.getState().load('guest')
    await useCreationDraftStore.getState().discard()
    preparePreviewScenario(item, scenario)

    useCreationDraftStore.getState().patch({
      ...emptyDraft(),
      contentSource: 'template',
      creationMode: 'local',
      selectedTemplate: {
        template: {
          templateId: item.templateId,
          templateVersion: item.currentVersion,
        },
        example: item.defaultExample,
        name: item.name,
      },
    })

    setOpen(true)
  }

  const last = savedSnapshots.at(-1)

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: 'auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>创建简历流程验收</h1>
      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}
      >
        <Button disabled={running} onClick={() => setOpen(true)}>
          打开创建简历
        </Button>
        <Button
          variant='outline'
          disabled={running}
          onClick={async () => {
            await useCreationDraftStore.getState().load('guest')
            await useCreationDraftStore.getState().discard()

            useCreationDraftStore
              .getState()
              .patch({ ...emptyDraft(), sourceText: importText })

            setOpen(true)
          }}
        >
          准备导入示例
        </Button>
        <Button
          variant='outline'
          disabled={running}
          onClick={() => {
            simulateUnknownResult()
            setMessage('下次真实写入后模拟响应丢失，随后可以重试确认。')
          }}
        >
          下次响应丢失
        </Button>
        <Button variant='outline' onClick={toggleReduced}>
          {reduced ? '关闭减少动效' : '开启减少动效'}
        </Button>
        <Button
          variant='outline'
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          切换深浅色
        </Button>
        <Button variant='outline' disabled={running} onClick={runChecks}>
          {running && <Spinner />}运行数据边界检查
        </Button>
        <Button
          variant='outline'
          disabled={running || open}
          onClick={async () => {
            try {
              setMessage(
                `已清理 ${await controls.cleanupDatabases()} 个临时数据库；继续验收请刷新。`,
              )
            } catch (error) {
              setMessage(String(error))
            }
          }}
        >
          清理临时数据
        </Button>
      </div>
      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlock: 16 }}
      >
        {(
          [
            ['ready', '恢复末屏模板'],
            ['entry-slow', '恢复：慢目录'],
            ['entry-error', '恢复：目录失败'],
            ['entry-missing', '恢复：目录缺失'],
            ['image-slow', '恢复：慢图片'],
            ['image-error', '恢复：图片失败'],
          ] as const
        ).map(([scenario, label]) => (
          <Button
            key={scenario}
            variant='outline'
            disabled={running}
            onClick={() => restore(scenario)}
          >
            {label}
          </Button>
        ))}
      </div>
      <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {message}
      </p>
      <p>
        流水线状态：{status}；实际插入：{insertCalls} 次。
      </p>
      <ul>
        {results.map((result) => (
          <li key={result}>通过：{result}</li>
        ))}
      </ul>
      {last && (
        <pre
          style={{
            marginTop: 16,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          {JSON.stringify(
            {
              operationId: last.operationId,
              displayName: last.displayName,
              description: last.description,
              template: last.snapshot.templateBinding,
              personName: last.snapshot.basics.name,
            },
            null,
            2,
          )}
        </pre>
      )}
      <CreateResumeCard
        hideTrigger
        online={false}
        open={open}
        onOpenChange={setOpen}
        onCreated={() => refresh((value) => value + 1)}
      />
      {!new URLSearchParams(location.search).has('clean') && (
        <AnimationSampler dialog={dialog} />
      )}
      {dialog &&
        !new URLSearchParams(location.search).has('clean') &&
        createPortal(
          <Button
            variant='secondary'
            size='sm'
            style={{
              position: 'absolute',
              right: 48,
              top: 17,
              height: 24,
              fontSize: 10,
              paddingInline: 6,
              zIndex: 20,
            }}
            onClick={toggleReduced}
          >
            {reduced ? '减动效开' : '减动效关'}
          </Button>,
          dialog,
        )}
      <Toaster />
    </div>
  )
}

export function mountFixture(controls: Controls) {
  createRoot(document.getElementById('root')!).render(
    <ThemeProvider defaultTheme='light' storageKey='creation-fixture-theme'>
      <MotionProvider>
        <TooltipProvider>
          <MemoryRouter initialEntries={['/resume']}>
            <Fixture controls={controls} />
          </MemoryRouter>
        </TooltipProvider>
      </MotionProvider>
    </ThemeProvider>,
  )
}
