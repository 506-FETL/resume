import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchSharedResume } from '@/lib/supabase/resume/share'
import SharePdfExport from '../components/share-pdf-export'

type ViewState
  = | { phase: 'loading' }
    | { phase: 'password', wrong: boolean, rateLimited: boolean }
    | {
      phase: 'ready'
      snapshot: PersistedResumeSnapshot
      templateManifest: TemplateManifest
      displayName: string | null
    }
    | { phase: 'unavailable' }

export default function ResumeSharePage() {
  const { token } = useParams<{ token: string }>()
  const reduceMotion = useReducedMotion()
  const [state, setState] = useState<ViewState>({ phase: 'loading' })
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const requestIdRef = useRef(0)
  const documentRef = useRef<HTMLDivElement>(null)
  const [documentReady, setDocumentReady] = useState(false)

  const load = useCallback(async (nextPassword?: string) => {
    const requestId = ++requestIdRef.current
    if (!token) {
      setState({ phase: 'unavailable' })
      return
    }

    try {
      const result = await fetchSharedResume(token, nextPassword)
      if (requestId !== requestIdRef.current)
        return
      if (result.unavailable) {
        setState({ phase: 'unavailable' })
        return
      }
      if (result.needPassword) {
        setState({
          phase: 'password',
          wrong: Boolean(result.wrongPassword),
          rateLimited: Boolean(result.rateLimited),
        })
        return
      }
      if (result.snapshot && result.templateManifest) {
        setState({
          phase: 'ready',
          snapshot: result.snapshot,
          templateManifest: result.templateManifest,
          displayName: result.displayName ?? null,
        })
        return
      }
    }
    catch {
      // 匿名查看页不暴露网络或服务端错误细节。
    }

    if (requestId === requestIdRef.current)
      setState({ phase: 'unavailable' })
  }, [token])

  useEffect(() => {
    setState({ phase: 'loading' })
    load().catch(() => setState({ phase: 'unavailable' }))
    return () => {
      requestIdRef.current += 1
    }
  }, [load])

  const handleSubmitPassword = async () => {
    setSubmitting(true)
    try {
      await load(password.trim())
    }
    finally {
      setSubmitting(false)
    }
  }

  const previewData = useMemo(
    () => state.phase === 'ready' ? buildTemplateResumeData(state.snapshot) : null,
    [state],
  )

  if (state.phase === 'loading') {
    return <CenteredMessage text="正在加载简历…" />
  }

  if (state.phase === 'unavailable') {
    return <CenteredMessage title="链接不可用" text="该分享链接不存在、已关闭或已过期。" />
  }

  if (state.phase === 'password') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
        <motion.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
          className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border bg-background p-6 shadow-lg"
        >
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold">需要访问密码</h1>
            <p className="text-sm text-muted-foreground">这份简历受密码保护，请输入密码继续查看。</p>
          </div>
          <Input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !submitting && password.trim())
                handleSubmitPassword().catch(() => undefined)
            }}
            placeholder="访问密码"
            autoComplete="current-password"
            autoFocus
          />
          {state.rateLimited && (
            <p className="text-sm text-destructive">尝试过于频繁，请稍后再试。</p>
          )}
          {!state.rateLimited && state.wrong && (
            <p className="text-sm text-destructive">密码错误，请重试。</p>
          )}
          <Button onClick={handleSubmitPassword} disabled={submitting || !password.trim()}>
            {submitting ? '验证中…' : '查看简历'}
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-dvh bg-muted/30"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur">
        <h1 className="truncate text-base font-semibold">{state.displayName || '简历'}</h1>
        <SharePdfExport
          contentRef={documentRef}
          ready={documentReady}
          documentTitle={state.displayName || '简历'}
        />
      </header>
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        <div className="rounded-xl bg-background p-2 shadow-sm sm:p-4">
          {previewData && (
            <ScaledReadonlyPreview
              data={previewData}
              appearance={state.snapshot}
              manifest={state.templateManifest}
              documentRef={documentRef}
              onDocumentReadyChange={setDocumentReady}
            />
          )}
        </div>
      </main>
    </motion.div>
  )
}

function CenteredMessage({ title, text }: { title?: string, text: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-muted/30 p-6 text-center">
      {title && <h1 className="text-lg font-semibold">{title}</h1>}
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
