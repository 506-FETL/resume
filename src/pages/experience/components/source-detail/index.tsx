import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsPresent } from 'motion/react'
import {
  ChevronDown,
  Download,
  Link2,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  ResponsiveDialog,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog'
import {
  ExperienceSourceReader,
  ExperienceUploadDialog,
} from '@/features/experience-sources'
import { ExperienceResumeRelations } from '@/features/experience-sources/resume-relations'
import {
  experienceError,
  formatSourceDate,
  KIND_LABEL,
  STATUS_LABEL,
} from '@/features/experience-sources/utils'
import ExperienceOriginalPreview from '@/features/experience-sources/original-preview'
import { Skeleton } from '@/components/ui/skeleton'
import type {
  ExperienceSourceReadResult,
  ExperienceSource,
} from '@/lib/experience-sources/types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { useExperiencePageStore } from '../../store'

export default function SourceDetail({
  sourceId,
  versionId,
  blockId,
  listSource,
}: {
  sourceId: string
  versionId?: string
  blockId?: string
  listSource?: ExperienceSource
}) {
  const [showExtracted, setShowExtracted] = useState(false)
  const [readAttempt, setReadAttempt] = useState(0)
  const [readError, setReadError] = useState<string | null>(null)
  const [detail, setDetail] = useState<ExperienceSourceReadResult | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [relationOpen, setRelationOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const deletedRef = useRef(false)
  const lifecycleRef = useRef({ mounted: false, selectionGeneration: 0 })
  const uploadSelectionRef = useRef<number | null>(null)
  const pendingDialogRef = useRef<(() => void) | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const present = useIsPresent()
  const reduced = useReducedMotion()

  useEffect(() => {
    const lifecycle = lifecycleRef.current

    lifecycle.mounted = true

    const unsubscribe = useExperiencePageStore.subscribe((state, previous) => {
      if (
        state.sourceId !== previous.sourceId ||
        state.versionId !== previous.versionId ||
        state.blockId !== previous.blockId ||
        state.navigationGeneration !== previous.navigationGeneration
      )
        lifecycle.selectionGeneration++
    })

    return () => {
      lifecycle.mounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true

    setReadError(null)

    useExperienceSourcesStore
      .getState()
      .read(
        sourceId,
        versionId ?? listSource?.currentVersionId ?? undefined,
        0,
        readAttempt > 0,
      )
      .then((next) => {
        if (active) setDetail(next)
      })
      .catch((cause) => {
        if (active) setReadError(experienceError(cause))
      })

    return () => {
      active = false
    }
  }, [sourceId, versionId, listSource?.currentVersionId, readAttempt])

  const onLoaded = useCallback(
    (next: ExperienceSourceReadResult) => setDetail(next),
    [],
  )

  const source = listSource ?? detail?.source

  const targetVersionId = versionId ?? listSource?.currentVersionId

  const reference =
    detail && (!targetVersionId || detail.version.id === targetVersionId)
      ? {
          sourceId,
          versionId: detail.version.id,
          name: source?.name ?? detail.source.name,
        }
      : null

  async function perform(action: () => Promise<void>) {
    setBusy(true)
    setError(null)

    try {
      await action()
    } catch (cause) {
      setError(experienceError(cause))
    } finally {
      setBusy(false)
    }
  }

  function requestDialog(action: () => void) {
    pendingDialogRef.current = action
  }

  async function download() {
    const generation = useExperienceSourcesStore.getState().generation

    if (!detail) return

    const blob = await useExperienceSourcesStore
      .getState()
      .original(sourceId, detail.version.id)

    if (generation !== useExperienceSourcesStore.getState().generation) return

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = detail?.version.fileName ?? source?.name ?? '职业档案'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <div className='space-y-4 border-b border-border/60 pb-5'>
        <h1
          title={source?.name}
          className='line-clamp-3 break-words text-xl leading-snug font-semibold sm:text-2xl'
        >
          {source?.name ?? '资料原文'}
        </h1>
        {source && (
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
            <p>
              {KIND_LABEL[source.kind]} · 更新于{' '}
              {formatSourceDate(source.updatedAt)}
            </p>
            {source.name.length > 32 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-auto px-1 py-0.5 text-xs text-muted-foreground'
                  >
                    完整名称
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='max-w-[calc(100vw-2rem)] break-words text-sm'>
                  {source.name}
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
        <div className='flex flex-wrap items-center gap-2'>
          {(detail
            ? detail.version.blockCount > 0
            : source?.kind !== 'image') && (
            <Button
              disabled={!reference || source?.status !== 'ready'}
              onClick={() => {
                if (reference)
                  navigate('/assistant', {
                    state: { experienceReferences: [reference] },
                  })
              }}
            >
              <Sparkles />
              用于 AI 助手
            </Button>
          )}
          {detail?.version.fileName && (
            <Button
              variant='outline'
              disabled={busy}
              onClick={() => perform(download)}
            >
              <Download />
              下载原件
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                ref={menuRef}
                size='icon'
                variant='ghost'
                aria-label='更多资料操作'
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align='end'
              className='min-w-40'
              onCloseAutoFocus={(event) => {
                if (!pendingDialogRef.current) return

                event.preventDefault()
                menuRef.current?.focus()

                const action = pendingDialogRef.current

                pendingDialogRef.current = null
                requestAnimationFrame(action)
              }}
            >
              <DropdownMenuItem
                disabled={!source}
                onSelect={() =>
                  requestDialog(() => {
                    setName(source?.name ?? '')
                    setError(null)
                    setRenameOpen(true)
                  })
                }
              >
                <Pencil />
                重命名
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  requestDialog(() => {
                    uploadSelectionRef.current =
                      lifecycleRef.current.selectionGeneration

                    setUpdateOpen(true)
                  })
                }
              >
                <Upload />
                上传新版本
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!reference}
                onSelect={() => requestDialog(() => setRelationOpen(true))}
              >
                <Link2 />
                关联简历
              </DropdownMenuItem>
              <DropdownMenuItem
                variant='destructive'
                onSelect={() =>
                  requestDialog(() => {
                    setError(null)
                    setDeleteOpen(true)
                  })
                }
              >
                <Trash2 />
                删除资料
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {busy && !renameOpen && !deleteOpen && <Spinner className='size-4' />}
        </div>
        {error && !renameOpen && !deleteOpen && (
          <p role='alert' className='text-sm text-destructive'>
            {error}
          </p>
        )}
        {source && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground'
              >
                资料信息
                <ChevronDown />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent
              style={reduced ? { animationDuration: '0s' } : undefined}
            >
              <div className='space-y-1 pb-3 text-xs leading-5 text-muted-foreground'>
                {detail && (
                  <>
                    <p>
                      此版本保存于 {formatSourceDate(detail.version.createdAt)}{' '}
                      · {detail.version.textLength} 字符 ·{' '}
                      {detail.version.blockCount} 段
                    </p>
                    <p>
                      {detail.version.id === source.currentVersionId
                        ? '当前版本'
                        : '历史版本，引用继续保留此版本原文。'}
                    </p>
                  </>
                )}
                <p>{STATUS_LABEL[source.status]}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
      {!detail && !readError && (
        <Skeleton className='my-5 aspect-[210/297] w-full' />
      )}
      {readError && (
        <div role='alert' className='space-y-2 py-5 text-sm'>
          <p className='text-destructive'>{readError}</p>
          <Button
            variant='outline'
            onClick={() => setReadAttempt((value) => value + 1)}
          >
            重新读取
          </Button>
        </div>
      )}
      {detail?.version.fileName && (
        <ExperienceOriginalPreview
          key={detail.version.id}
          sourceId={sourceId}
          version={detail.version}
        />
      )}
      {detail?.version.fileName &&
        detail.version.blockCount > 0 &&
        !blockId && (
          <Collapsible open={showExtracted} onOpenChange={setShowExtracted}>
            <CollapsibleTrigger asChild>
              <Button variant='outline'>
                提取文字
                <ChevronDown />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent
              style={reduced ? { animationDuration: '0s' } : undefined}
            >
              <ExperienceSourceReader
                sourceId={sourceId}
                versionId={detail.version.id}
                onLoaded={onLoaded}
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      {detail && (!detail.version.fileName || blockId) && (
        <ExperienceSourceReader
          sourceId={sourceId}
          versionId={detail.version.id}
          blockId={blockId}
          onLoaded={onLoaded}
        />
      )}
      <ExperienceUploadDialog
        open={updateOpen}
        onOpenChange={setUpdateOpen}
        sourceId={sourceId}
        onComplete={(references) => {
          const reference = references.find(
            (item) => item.sourceId === sourceId,
          )

          const selection = useExperiencePageStore.getState()
          const lifecycle = lifecycleRef.current

          if (
            !reference ||
            !lifecycle.mounted ||
            !present ||
            location.pathname !== '/experience'
          )
            return
          if (
            !selection.detailOpen ||
            selection.sourceId !== sourceId ||
            uploadSelectionRef.current !== lifecycle.selectionGeneration
          )
            return

          toast.success('新版本已保存')
          useExperiencePageStore.setState({ versionId: reference.versionId })
        }}
      />
      {reference && (
        <ExperienceResumeRelations
          open={relationOpen}
          onOpenChange={setRelationOpen}
          reference={reference}
        />
      )}
      <ResponsiveDialog open={renameOpen} onOpenChange={setRenameOpen}>
        <ResponsiveDialogHeader className='px-6 pt-6'>
          <ResponsiveDialogTitle>重命名资料</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            更改资料库名称，保留原文与历史版本。
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className='space-y-3 px-6 py-4'>
          <Input
            aria-label='资料名称'
            value={name}
            maxLength={160}
            onChange={(event) => setName(event.target.value)}
          />
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}
        </div>
        <ResponsiveDialogFooter>
          <Button variant='outline' onClick={() => setRenameOpen(false)}>
            取消
          </Button>
          <Button
            disabled={busy || !name.trim()}
            onClick={() => {
              perform(async () => {
                const generation =
                  useExperienceSourcesStore.getState().generation

                const updatedSource = await useExperienceSourcesStore
                  .getState()
                  .rename(sourceId, name.trim().slice(0, 160))

                if (
                  generation !== useExperienceSourcesStore.getState().generation
                )
                  return

                setDetail((current) =>
                  current ? { ...current, source: updatedSource } : current,
                )

                setRenameOpen(false)
              })
            }}
          >
            {busy && <Spinner />}保存名称
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent
          style={reduced ? { animationDuration: '0s' } : undefined}
          onCloseAutoFocus={(event) => {
            if (!deletedRef.current) return

            event.preventDefault()

            document
              .querySelector<HTMLButtonElement>('[data-experience-upload]')
              ?.focus({ preventScroll: true })
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>删除这份资料？</AlertDialogTitle>
            <AlertDialogDescription>
              原件、提取文字与全部版本将被删除，后续无法继续引用。已发送的聊天文字仍会保留，需要清除时请另行删除对应对话。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <Button
              variant='destructive'
              disabled={busy}
              onClick={() => {
                perform(async () => {
                  const generation =
                    useExperienceSourcesStore.getState().generation

                  await useExperienceSourcesStore.getState().remove(sourceId)

                  if (
                    generation !==
                    useExperienceSourcesStore.getState().generation
                  )
                    return

                  deletedRef.current = true
                  setDeleteOpen(false)

                  useExperiencePageStore.getState().closeDetail()

                  if (
                    location.search ||
                    (location.state as { sourceId?: string } | null)?.sourceId
                  )
                    navigate('/experience', { replace: true, state: null })

                  useExperiencePageStore.setState({
                    sourceId: null,
                    blockId: undefined,
                    versionId: undefined,
                  })

                  toast.success('资料已删除')
                })
              }}
            >
              {busy && <Spinner />}
              {error ? '重试删除' : '删除资料'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
