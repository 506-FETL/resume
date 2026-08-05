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

  if (isMobile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`管理「${title}」`}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onRename}>
              <Pencil />
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              删除
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      <Button variant="ghost" size="icon-sm" aria-label="重命名" onClick={onRename}>
        <Pencil className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="删除" onClick={onDelete}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}
