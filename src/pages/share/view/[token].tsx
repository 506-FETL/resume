import type { RefObject } from 'react'
import type { ShareCommentAccess } from './hooks/use-share-comment-access'
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import type { ShareViewResult } from '@/lib/supabase/resume/share.types'
import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CommentBookmark } from '@/features/resume-comments/components/comment-bookmark.tsx'
import { CommentSurface } from '@/features/resume-comments/components/comment-surface.tsx'
import { ResumeCommentProvider, useResumeCommentStore } from '@/features/resume-comments/context.tsx'
import useCurrentUser from '@/hooks/use-current-user'
import { DEFAULT_RESUME_FONT_FAMILY_NAME } from '@/lib/schema'
import { fetchSharedResume } from '@/lib/supabase/resume/share'
import PdfExport from '../components/pdf-export'
import { readShareCommentAccess, useShareCommentAccess } from './hooks/use-share-comment-access'

type ViewState
  = | { phase: 'loading' }
    | { phase: 'password', wrong: boolean, rateLimited: boolean }
    | {
      phase: 'ready'
      snapshot: PersistedResumeSnapshot
      templateManifest: TemplateManifest
      displayName: string | null
      shareId: string
      releaseId: string
      releaseNo: number | null
      versionId: number
      documentRevision: number
      allowComments: boolean
      projectionReferenceDate: string | undefined
      commentAccess: ShareCommentAccess | null
    }
    | { phase: 'unavailable' }

export default function ResumeSharePage() {
  const { token } = useParams<{ token: string }>()
  const reduceMotion = useReducedMotion()
  const [state, setState] = useState<ViewState>({ phase: 'loading' })
  const [password, setPassword] = useState('')
  const [verifiedPassword, setVerifiedPassword] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const requestIdRef = useRef(0)
  const documentRef = useRef<HTMLDivElement>(null)
  const currentUser = useCurrentUser()
  const [documentState, setDocumentState] = useState<ResumeDocumentState>({
    status: 'measuring',
    signature: null,
    fontFamily: DEFAULT_RESUME_FONT_FAMILY_NAME,
    fontWeights: [400, 600, 700],
    error: null,
  })

  const applyResult = useCallback((result: ShareViewResult, acceptedPassword?: string) => {
    if (result.unavailable) {
      setState({ phase: 'unavailable' })
      return
    }
    if (result.needPassword) {
      setVerifiedPassword(undefined)
      setState({
        phase: 'password',
        wrong: Boolean(result.wrongPassword),
        rateLimited: Boolean(result.rateLimited),
      })
      return
    }
    if (!result.snapshot || !result.templateManifest) {
      setState({ phase: 'unavailable' })
      return
    }

    if (acceptedPassword !== undefined)
      setVerifiedPassword(acceptedPassword)
    const releaseId = result.releaseId ?? ''
    const commentAccess = readShareCommentAccess(result)
    setState(previous => previous.phase === 'ready' && previous.releaseId === releaseId
      ? {
          ...previous,
          snapshot: result.snapshot!,
          templateManifest: result.templateManifest!,
          versionId: result.versionId ?? previous.versionId,
          documentRevision: result.documentRevision ?? previous.documentRevision,
          displayName: result.displayName ?? null,
          allowComments: result.allowComments === true,
          projectionReferenceDate: result.projectionReferenceDate,
          commentAccess,
        }
      : {
          phase: 'ready',
          snapshot: result.snapshot!,
          templateManifest: result.templateManifest!,
          displayName: result.displayName ?? null,
          shareId: result.shareId ?? '',
          releaseId,
          releaseNo: result.releaseNo ?? null,
          versionId: result.versionId ?? 0,
          documentRevision: result.documentRevision ?? 0,
          allowComments: result.allowComments === true,
          projectionReferenceDate: result.projectionReferenceDate,
          commentAccess,
        })
  }, [])

  const load = useCallback(async (nextPassword?: string, refresh = false) => {
    const requestId = ++requestIdRef.current
    if (!token) {
      setState({ phase: 'unavailable' })
      return
    }

    try {
      const result = await fetchSharedResume(token, nextPassword, { refresh })
      if (requestId !== requestIdRef.current)
        return
      applyResult(result, nextPassword)
      return
    }
    catch {
      // 匿名查看页不暴露网络或服务端错误细节。
    }

    if (requestId === requestIdRef.current)
      setState({ phase: 'unavailable' })
  }, [applyResult, token])

  const handleRefreshResult = useCallback((result: ShareViewResult) => {
    applyResult(result)
  }, [applyResult])
  const refreshCommentAccess = useShareCommentAccess({
    token,
    password: verifiedPassword,
    onRefreshResult: handleRefreshResult,
  })
  const handleCommentAccessInvalidated = useCallback(() => {
    load(verifiedPassword, true).catch(() => setState({ phase: 'unavailable' }))
  }, [load, verifiedPassword])

  useEffect(() => {
    setState({ phase: 'loading' })
    setPassword('')
    setVerifiedPassword(undefined)
    setCommentsOpen(false)
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
        <PdfExport
          contentRef={documentRef}
          documentState={documentState}
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
              onDocumentStateChange={setDocumentState}
              projectionReferenceDate={state.projectionReferenceDate}
            />
          )}
        </div>
      </main>
      {state.commentAccess
        ? (
            <ResumeCommentProvider
              access={state.commentAccess.context}
              refreshAccess={refreshCommentAccess}
              onAccessInvalidated={handleCommentAccessInvalidated}
            >
              <ShareResumeComments
                rootRef={documentRef}
                sourceLabel={`${state.displayName || '简历'}${state.releaseNo ? ` · 第 ${state.releaseNo} 版` : ''}`}
                allowComments={state.allowComments}
                currentUserId={currentUser?.id ?? null}
                open={commentsOpen}
                onOpenChange={setCommentsOpen}
                layoutRevision={JSON.stringify(documentState.signature)}
                documentRevision={state.documentRevision}
              />
            </ResumeCommentProvider>
          )
        : null}
    </motion.div>
  )
}

function ShareResumeComments({
  rootRef,
  sourceLabel,
  allowComments,
  currentUserId,
  open,
  onOpenChange,
  layoutRevision,
  documentRevision,
}: {
  rootRef: RefObject<HTMLElement | null>
  sourceLabel: string
  allowComments: boolean
  currentUserId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  layoutRevision: string
  documentRevision: number
}) {
  const hasUnread = useResumeCommentStore(state => Object.values(state.threadReadStateById)
    .some(thread => thread.latestCommentEventSeq > Math.max(
      thread.lastReadEventSeq,
      state.lastReadEventSeq,
    )))
  const selection = useResumeCommentStore(state => state.selection)
  const setSelection = useResumeCommentStore(state => state.setSelection)
  const setContentNotice = useResumeCommentStore(state => state.setContentNotice)
  const previousRevision = useRef(documentRevision)
  useEffect(() => {
    if (previousRevision.current === documentRevision)
      return
    previousRevision.current = documentRevision
    if (!selection)
      return
    setSelection(null)
    setContentNotice('简历内容已更新，请重新选择文字后发送。已输入的评论草稿仍然保留。')
  }, [documentRevision, selection, setContentNotice, setSelection])
  return (
    <>
      {!open
        ? (
            <CommentBookmark unread={hasUnread} onOpen={() => onOpenChange(true)} />
          )
        : null}
      <CommentSurface
        rootRef={rootRef}
        sourceLabel={sourceLabel}
        permissions={{
          canCreate: allowComments,
          canModerateAll: false,
          currentUserId,
        }}
        layoutRevision={layoutRevision}
        open={open}
        onOpenChange={onOpenChange}
      />
    </>
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
