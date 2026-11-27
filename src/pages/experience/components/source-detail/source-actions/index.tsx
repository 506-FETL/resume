import { useEffect, useRef, useState } from 'react'
import { useIsPresent } from 'motion/react'
import {
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
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeferredExperienceUploadDialog as ExperienceUploadDialog } from '@/features/experience-sources/deferred-upload-dialog'
import { deferDialog } from '@/components/deferred-dialog'
import { experienceError } from '@/features/experience-sources/utils'
import type {
  ExperienceSourceReadResult,
  ExperienceSourceReference,
  ExperienceSource,
} from '@/lib/experience-sources/types'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { useExperiencePageStore } from '../../../store'
import { RenameSourceDialog } from '../rename-dialog'
import { DeleteSourceDialog } from '../delete-dialog'
import { CopySourceButton } from '../copy-source-button'

const RelationsDialog = deferDialog(
  () => import('@/features/experience-sources/resume-relations'),
  '关联到简历',
  'ExperienceResumeRelations',
)

export function SourceActions({
  sourceId,
  source,
  detail,
  reference,
  onRenamed,
}: {
  sourceId: string
  source: ExperienceSource
  detail: ExperienceSourceReadResult
  reference: ExperienceSourceReference
  onRenamed: (source: ExperienceSource) => void
}) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [relationOpen, setRelationOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const lifecycleRef = useRef({ mounted: false, selectionGeneration: 0 })
  const uploadSelectionRef = useRef<number | null>(null)
  const pendingDialogRef = useRef<(() => void) | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const present = useIsPresent()

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

    const blob = await useExperienceSourcesStore
      .getState()
      .original(sourceId, detail.version.id)

    if (generation !== useExperienceSourcesStore.getState().generation) return

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = detail.version.fileName ?? source.name
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <div className='flex flex-wrap items-center gap-2'>
        {detail.version.blockCount > 0 && (
          <Button
            disabled={source.status !== 'ready'}
            onClick={() => {
              navigate('/assistant', {
                state: { experienceReferences: [reference] },
              })
            }}
          >
            <Sparkles />
            用于 AI 助手
          </Button>
        )}
        {detail.version.fileName && (
          <Button
            variant='outline'
            disabled={busy}
            onClick={() => perform(download)}
          >
            <Download />
            下载原件
          </Button>
        )}
        {!detail.version.fileName && (
          <CopySourceButton sourceId={sourceId} versionId={detail.version.id} />
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
              onSelect={() =>
                requestDialog(() => {
                  setError(null)
                  setRenameOpen(true)
                })
              }
            >
              <Pencil />
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem
              onPointerEnter={ExperienceUploadDialog.preload}
              onFocus={ExperienceUploadDialog.preload}
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
      )}{' '}
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
      <RelationsDialog
        open={relationOpen}
        onClose={() => setRelationOpen(false)}
      >
        {(Content, trigger) => (
          <Content
            open={relationOpen}
            onOpenChange={setRelationOpen}
            reference={reference}
            returnFocusTo={trigger}
          />
        )}
      </RelationsDialog>
      <RenameSourceDialog
        sourceId={sourceId}
        sourceName={source.name}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        onRenamed={onRenamed}
        operation={{ busy, error, perform }}
      />
      <DeleteSourceDialog
        sourceId={sourceId}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        operation={{ busy, error, perform }}
      />
    </>
  )
}
