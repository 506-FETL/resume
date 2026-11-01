import { useRef } from 'react'
import { Ellipsis, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/hooks/use-mobile'

interface ConversationActionsProps {
  title: string
  onRename: () => void
  onDelete: () => void
}

export function ConversationActions({
  title,
  onRename,
  onDelete,
}: ConversationActionsProps) {
  const isMobile = useIsMobile()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const actionAfterCloseRef = useRef<(() => void) | null>(null)

  if (isMobile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label={`管理「${title}」`}
            ref={triggerRef}
            data-conversation-delete-trigger=''
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          onCloseAutoFocus={(event) => {
            const action = actionAfterCloseRef.current

            if (!action) return

            event.preventDefault()
            actionAfterCloseRef.current = null
            triggerRef.current?.focus({ preventScroll: true })
            action()
          }}
        >
          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={() => {
                actionAfterCloseRef.current = onRename
              }}
            >
              <Pencil />
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem
              variant='destructive'
              onSelect={() => {
                actionAfterCloseRef.current = onDelete
              }}
            >
              <Trash2 />
              删除
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className='flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100'>
      <Button
        variant='ghost'
        size='icon-sm'
        aria-label='重命名'
        onClick={onRename}
      >
        <Pencil className='size-3.5' />
      </Button>
      <Button
        variant='ghost'
        size='icon-sm'
        aria-label='删除'
        data-conversation-delete-trigger=''
        onClick={onDelete}
      >
        <Trash2 className='size-3.5' />
      </Button>
    </div>
  )
}
