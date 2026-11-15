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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const actionAfterCloseRef = useRef<(() => void) | null>(null)

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
