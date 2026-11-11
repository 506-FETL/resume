import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { ThemeProvider } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import supabase from '@/lib/supabase/client'
import { useJobContextStore } from '@/lib/job-context'
import useUserStore from '@/store/user'
import ResumePage from '@/pages/resume'
import useResumeListStore from '@/pages/resume/store'
import { useResumePreviewStore } from '@/pages/resume/store/preview-cache'
import {
  fixtureControls,
  fixtureAuth,
  fixtureRequests,
  fixtureUser,
  params,
  scenario,
  withContext,
} from './boundary'
import '@/index.css'

await supabase.auth.getSession()

const session: Session = {
  user: fixtureUser,
  access_token: 'isolated-fixture-token',
  refresh_token: 'isolated-fixture-refresh',
  token_type: 'bearer',
  expires_in: 3600,
}

supabase.auth.getSession = async () => ({ data: { session }, error: null })

supabase.auth.onAuthStateChange = () => ({
  data: {
    subscription: {
      id: 'isolated-fixture',
      callback: () => {},
      unsubscribe: () => {},
    },
  },
})

if (params.get('authInit') === 'delayed') {
  fixtureAuth.currentUser = null
  useUserStore.setState({ currentUser: null, authStatus: 'unknown' })
} else {
  useUserStore.getState().setCurrentUser(fixtureUser)
}

useResumeListStore.setState({ setupRealtimeSubscription: () => () => {} })
useResumePreviewStore.setState({ acquire: () => () => {} })

const jobId = '00000000-0000-4000-8000-000000000201'

if (withContext) {
  useJobContextStore.getState().setContext({
    id: jobId,
    userId: fixtureUser.id,
    company: '示例团队',
    position: '平台产品与研发岗位（长岗位名称隔离验收）',
    jdText: '',
    resumeId: null,
    resumeType: null,
    resumeName: null,
  })
}

const stateEvents: { loading: boolean; page: number; error: string | null }[] =
  []

const authObservations: { phase: string; requests: number }[] = []

let automaticScenarioStarted = false

useResumeListStore.subscribe((state) => {
  stateEvents.push({
    loading: state.libraryLoading,
    page: state.libraryPage,
    error: state.libraryError,
  })

  document.dispatchEvent(new Event('fixture-metrics'))

  if (
    !automaticScenarioStarted &&
    (scenario === 'error' || scenario === 'loading') &&
    !state.libraryLoading &&
    state.libraryItems.length > 0
  ) {
    automaticScenarioStarted = true
    queueMicrotask(() => useResumeListStore.getState().loadLibraryPage(2))
  }
})

function PaginationFixture() {
  const [controlsOpen, setControlsOpen] = useState(
    params.get('controls') === '1',
  )

  const [, setRevision] = useState(0)
  const store = useResumeListStore()

  useEffect(() => {
    const update = () => setRevision((value) => value + 1)

    document.documentElement.dataset.fixtureReady = 'true'
    document.addEventListener('fixture-metrics', update)

    const timer =
      params.get('authInit') === 'delayed'
        ? window.setTimeout(() => {
            authObservations.push({
              phase: 'unknown-before-init',
              requests: fixtureRequests.length,
            })

            fixtureAuth.currentUser = fixtureUser
            useUserStore.getState().setCurrentUser(fixtureUser)
          }, 350)
        : undefined

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('fixture-metrics', update)
    }
  }, [])

  return (
    <ThemeProvider
      defaultTheme={params.get('theme') === 'dark' ? 'dark' : 'light'}
    >
      <TooltipProvider>
        <MemoryRouter
          initialEntries={[withContext ? `/resume?jobId=${jobId}` : '/resume']}
        >
          <DashboardShell routeKey='/resume'>
            <ResumePage />
          </DashboardShell>
          <Toaster />
        </MemoryRouter>
        <output data-fixture-report hidden>
          {JSON.stringify({
            requests: fixtureRequests,
            stateEvents,
            page: store.libraryPage,
            total: store.libraryTotal,
            loading: store.libraryLoading,
            error: store.libraryError,
            input: store.librarySearchInput,
            query: store.libraryQuery,
            counts: store.libraryCounts,
            authStatus: useUserStore.getState().authStatus,
            accountId: store.libraryAccountId,
            authObservations,
            items: store.libraryItems.map((item) => item.resume_id),
          })}
        </output>
        {params.get('controls') === '1' && (
          <aside
            style={{
              position: 'fixed',
              zIndex: 100,
              top: 60,
              right: 12,
              maxWidth: 'calc(100vw - 24px)',
            }}
          >
            <Button
              size='sm'
              variant='outline'
              onClick={() => setControlsOpen((value) => !value)}
            >
              {controlsOpen ? '收起验收设置' : '展开验收设置'}
            </Button>
            {controlsOpen && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  padding: 8,
                  marginTop: 4,
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  maxWidth: 400,
                }}
              >
                <Button
                  size='sm'
                  onClick={() => {
                    fixtureControls.pause = false

                    fixtureControls.releases
                      .splice(0)
                      .forEach((release) => release())
                  }}
                >
                  完成本次加载
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    fixtureControls.failNextPage = store.libraryPage + 1
                  }}
                >
                  下一页失败一次
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    fixtureControls.pause = true
                  }}
                >
                  暂停下一次翻页
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    fixtureControls.delay = 50
                  }}
                >
                  请求延迟 50ms
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    fixtureControls.delay = 1500
                  }}
                >
                  请求延迟 1500ms
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    fixtureRequests.splice(0)
                    stateEvents.splice(0)
                    document.dispatchEvent(new Event('fixture-metrics'))
                  }}
                >
                  清空观测记录
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    const input = document.getElementById(
                      'resume-library-search',
                    ) as HTMLInputElement | null

                    if (!input) return

                    input.focus()

                    input.dispatchEvent(
                      new CompositionEvent('compositionstart', {
                        bubbles: true,
                      }),
                    )

                    updateSearchInput(input, '描述', true)
                  }}
                >
                  开始中文组合输入
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => finishSearchComposition(false)}
                >
                  完成中文组合输入
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => finishSearchComposition(true)}
                >
                  完成后立即清空
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    const user = {
                      ...fixtureUser,
                      id: '00000000-0000-4000-8000-000000000102',
                    }

                    fixtureAuth.currentUser = user
                    session.user = user
                    useUserStore.getState().setCurrentUser(user)
                  }}
                >
                  切到账户 B
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    fixtureAuth.currentUser = fixtureUser
                    session.user = fixtureUser
                    useUserStore.getState().setCurrentUser(fixtureUser)
                  }}
                >
                  返回账户 A
                </Button>
              </div>
            )}
          </aside>
        )}
      </TooltipProvider>
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(<PaginationFixture />)

function updateSearchInput(
  input: HTMLInputElement,
  value: string,
  composing: boolean,
) {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, value)

  input.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      data: value,
      isComposing: composing,
      inputType: 'insertCompositionText',
    }),
  )
}

function finishSearchComposition(clear: boolean) {
  const input = document.getElementById(
    'resume-library-search',
  ) as HTMLInputElement | null

  if (!input) return

  input.focus()
  updateSearchInput(input, '仅描述本地', true)

  input.dispatchEvent(
    new CompositionEvent('compositionend', {
      bubbles: true,
      data: '仅描述本地',
    }),
  )

  if (clear) {
    setTimeout(() => {
      document
        .querySelector<HTMLButtonElement>('[aria-label="清空搜索"]')
        ?.click()
    }, 30)
  }
}
