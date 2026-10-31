import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import {
  Archive,
  ArrowUpRight,
  History,
  MoreHorizontal,
  Power,
  Settings2,
  Trash2,
} from 'lucide-react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import useShareStore from '../../store'
import { buildShareUrl } from '../../utils'
import CopyLinkButton from '../copy-link-button'

export default function CardActions({ share }: { share: ResumeShareRecord }) {
  const {
    pendingShareIds,
    openSettingsDialog,
    openArchiveDialog,
    openDeleteDialog,
    openVersionDialog,
    setActive,
  } = useShareStore()

  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const actionAfterCloseRef = useRef<(() => void) | null>(null)
  const busy = pendingShareIds.includes(share.id)
  const archived = Boolean(share.archivedAt)
  const title = share.label || share.display_name || '未命名简历'
  const url = buildShareUrl(share.token)

  const handleToggleActive = async () => {
    try {
      await setActive(share.id, !share.is_active)
      toast.success(share.is_active ? '链接已关闭' : '链接已启用')
    } catch {
      toast.error('操作失败')
    }
  }

  return (
    <div
      role='group'
      aria-label={`${title}的操作`}
      className='flex items-center gap-1.5 @min-[600px]/share-links:w-56'
    >
      <CopyLinkButton url={url} />
      <Button
        variant='ghost'
        className='h-9 gap-1.5 px-3 text-xs shadow-none'
        disabled={archived}
        aria-label={`预览简历：${title}`}
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      >
        预览
        <ArrowUpRight className='size-3.5' />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={menuTriggerRef}
            variant='ghost'
            size='icon'
            aria-label={`更多操作：${title}`}
            disabled={busy}
            className='text-muted-foreground shadow-none'
          >
            {busy ? <Spinner /> : <MoreHorizontal className='size-4' />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          className='max-h-(--radix-dropdown-menu-content-available-height) w-48 overflow-y-auto overscroll-contain'
          onCloseAutoFocus={(event) => {
            const action = actionAfterCloseRef.current

            if (!action) return

            event.preventDefault()
            actionAfterCloseRef.current = null
            menuTriggerRef.current?.focus({ preventScroll: true })
            action()
          }}
        >
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={busy || archived}
              onSelect={() => {
                actionAfterCloseRef.current = () => openSettingsDialog(share.id)
              }}
            >
              <Settings2 />
              编辑设置
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy || archived}
              onSelect={() => {
                actionAfterCloseRef.current = () => openVersionDialog(share.id)
              }}
            >
              <History />
              更换分享版本
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy || archived}
              onClick={handleToggleActive}
            >
              <Power />
              {share.is_active ? '关闭链接' : '启用链接'}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {!archived && (
              <DropdownMenuItem
                disabled={busy}
                onSelect={() => {
                  actionAfterCloseRef.current = () =>
                    openArchiveDialog(share.id)
                }}
              >
                <Archive />
                归档分享
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant='destructive'
              disabled={busy}
              onSelect={() => {
                actionAfterCloseRef.current = () => openDeleteDialog(share.id)
              }}
            >
              <Trash2 />
              永久删除
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
