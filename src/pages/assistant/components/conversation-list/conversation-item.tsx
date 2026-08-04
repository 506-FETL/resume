import type { AiConversation } from '@/lib/ai/types'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ConversationItemProps {
  conversation: AiConversation
  active: boolean
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

export function ConversationItem({ conversation, active, onSelect, onRename, onDelete }: ConversationItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conversation.title)
  const [pendingDelete, setPendingDelete] = useState(false)

  const commitRename = () => {
    const next = draft.trim()
    if (next && next !== conversation.title)
      onRename(conversation.id, next)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-lg border bg-card px-2 py-1.5">
        <Input
          value={draft}
          autoFocus
          className="h-7 flex-1"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter')
              commitRename()
            if (e.key === 'Escape')
              setEditing(false)
          }}
        />
        <Button variant="ghost" size="icon-sm" aria-label="确认" onClick={commitRename}><Check className="size-3.5" /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="取消" onClick={() => setEditing(false)}><X className="size-3.5" /></Button>
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          'group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/60',
          active && 'bg-muted font-medium',
        )}
        onClick={() => onSelect(conversation.id)}
      >
        <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="重命名"
            onClick={(e) => {
              e.stopPropagation()
              setDraft(conversation.title)
              setEditing(true)
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="删除"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              setPendingDelete(true)
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={pendingDelete} onOpenChange={open => !open && setPendingDelete(false)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该会话？</AlertDialogTitle>
            <AlertDialogDescription>
              {`「${conversation.title}」及其全部消息将被永久删除，无法恢复。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(false)}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setPendingDelete(false)
                onDelete(conversation.id)
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
