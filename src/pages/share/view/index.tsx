import type { ReadingZoom } from './components/reading-toolbar'
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import AnimatedContent from '@/components/motion/animated-content'
import { PageLoading } from '@/components/page-loading'
import { A4_PAGE_WIDTH } from '@/components/resume/pagination/const'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResumeCommentProvider } from '@/features/resume-comments/context.tsx'
import useCurrentUser from '@/hooks/use-current-user'
import PdfExport from '../components/pdf-export'
import CenteredMessage from './components/centered-message'
import { ReadingToolbar } from './components/reading-toolbar'
import ShareResumeComments from './components/share-resume-comments'
import { INITIAL_DOCUMENT_STATE } from './const'
import { useShareView } from './hooks/use-share-view'

export default function ResumeSharePage() {
  const { token } = useParams<{ token: string }>()
  const { state, load, refreshCommentAccess } = useShareView(token)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [readingZoom, setReadingZoom] = useState<ReadingZoom>('fit')
  const documentRef = useRef<HTMLDivElement>(null)
  const currentUser = useCurrentUser()
  const [documentState, setDocumentState] = useState<ResumeDocumentState>(
    INITIAL_DOCUMENT_STATE,
  )
  const snapshot = state.phase === 'ready' ? state.snapshot : null
  const definition = state.phase === 'ready' ? state.templateDefinition : null
  const measuredContent = useRef<{
    snapshot: typeof snapshot
    definition: typeof definition
  } | null>(null)
  const handleDocumentStateChange = useCallback(
    (next: ResumeDocumentState) => {
      measuredContent.current = { snapshot, definition }
      setDocumentState(next)
    },
    [snapshot, definition],
  )
  const exportDocumentState =
    measuredContent.current?.snapshot === snapshot &&
    measuredContent.current?.definition === definition
      ? documentState
      : INITIAL_DOCUMENT_STATE
  useEffect(() => {
    setPassword('')
    setCommentsOpen(false)
    measuredContent.current = null
  }, [token])
  const handleCommentAccessInvalidated = useCallback(() => {
    load(undefined, true).catch(() => undefined)
  }, [load])
  const handleSubmitPassword = async () => {
    setSubmitting(true)
    try {
      await load(password.trim()).catch(() => undefined)
    } finally {
      setSubmitting(false)
    }
  }

  const previewData = useMemo(
    () => (snapshot ? buildTemplateResumeData(snapshot) : null),
    [snapshot],
  )

  const renderContent = () => {
    if (state.phase === 'loading') {
      return (
        <div role='status' aria-label='正在加载简历'>
          <PageLoading className='min-h-dvh bg-muted/30' />
        </div>
      )
    }

    if (state.phase === 'unavailable') {
      return (
        <CenteredMessage
          title='链接不可用'
          text='该分享链接不存在、已关闭或已过期。'
        />
      )
    }

    if (state.phase === 'password') {
      return (
        <div className='flex min-h-dvh items-center justify-center bg-muted/30 p-6'>
          <div className='flex w-full max-w-sm flex-col gap-4 rounded-2xl border bg-background p-6 shadow-lg'>
            <h1 className='text-lg font-semibold'>需要访问密码</h1>
            <Input
              type='password'
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !submitting && password.trim())
                  handleSubmitPassword().catch(() => undefined)
              }}
              placeholder='访问密码'
              aria-label='访问密码'
              autoComplete='current-password'
              autoFocus
            />
            <AnimatedContent
              animationKey={
                state.rateLimited ? 'limited' : state.wrong ? 'wrong' : 'none'
              }
              className='empty:hidden'
            >
              {state.rateLimited && (
                <p role='alert' className='text-sm text-destructive'>
                  尝试过于频繁，请稍后再试。
                </p>
              )}
              {!state.rateLimited && state.wrong && (
                <p role='alert' className='text-sm text-destructive'>
                  密码错误，请重试。
                </p>
              )}
            </AnimatedContent>
            <Button
              onClick={handleSubmitPassword}
              disabled={submitting || !password.trim()}
            >
              {submitting ? '验证中…' : '查看简历'}
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className='min-h-dvh bg-muted/30'>
        <header className='sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur print:hidden'>
          <div className='min-w-0 flex-1'>
            <h1 className='truncate text-base font-semibold'>
              {state.displayName || '简历'}
            </h1>
            <p className='text-xs text-muted-foreground'>
              {state.sourceKind === 'current' ? '保存后自动同步' : '固定内容'}
            </p>
          </div>
          <PdfExport
            contentRef={documentRef}
            documentState={exportDocumentState}
            documentTitle={state.displayName || '简历'}
          />
          <div className='flex basis-full justify-center sm:order-none sm:basis-auto'>
            <ReadingToolbar zoom={readingZoom} onZoomChange={setReadingZoom} />
          </div>
        </header>
        <main
          className='w-full overflow-x-auto px-2 py-4 [overflow-anchor:none] sm:px-6 sm:py-6'
          aria-label='简历阅读区'
          tabIndex={0}
        >
          <div
            className='mx-auto max-w-none bg-background shadow-sm'
            style={{
              width:
                readingZoom === 'fit'
                  ? `min(100%, ${A4_PAGE_WIDTH})`
                  : `calc(${A4_PAGE_WIDTH} * ${readingZoom / 100})`,
            }}
          >
            {previewData && (
              <ScaledReadonlyPreview
                data={previewData}
                appearance={state.snapshot}
                definition={state.templateDefinition}
                documentRef={documentRef}
                onDocumentStateChange={handleDocumentStateChange}
                projectionReferenceDate={state.projectionReferenceDate}
              />
            )}
          </div>
        </main>
        {state.commentAccess ? (
          <ResumeCommentProvider
            access={state.commentAccess.context}
            refreshAccess={refreshCommentAccess}
            onAccessInvalidated={handleCommentAccessInvalidated}
          >
            <ShareResumeComments
              rootRef={documentRef}
              sourceLabel={`${state.displayName || '简历'}${state.sourceKind === 'current' ? ' · 当前版本' : state.releaseNo ? ` · 第 ${state.releaseNo} 版` : ''}`}
              allowComments={state.allowComments}
              currentUserId={currentUser?.id ?? null}
              open={commentsOpen}
              onOpenChange={setCommentsOpen}
              layoutRevision={`${JSON.stringify(documentState.signature)}:${readingZoom}`}
              documentRevision={state.documentRevision}
            />
          </ResumeCommentProvider>
        ) : null}
      </div>
    )
  }

  return (
    <AnimatedContent animationKey={state.phase}>
      {renderContent()}
    </AnimatedContent>
  )
}
