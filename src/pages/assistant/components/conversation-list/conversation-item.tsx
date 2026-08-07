import type { AiConversation } from '@/lib/ai/types'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ConversationActions } from './conversation-actions'
import { ConversationDeleteDialog } from './conversation-delete-dialog'

interface ConversationItemProps {
  conversation: AiConversation
  active: boolean
  pending: boolean
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

export function ConversationItem({ conversation, active, pending, onSelect, onRename, onDelete }: ConversationItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conversation.title)
  const [pendingDelete, setPendingDelete] = useState(false)

  const commitRename = () => {
    const next = draft.trim()
    if (next && next !== conversation.title)
      onRename(conversation.id, next)
    setEditing(false)
  }

  const startRename = () => {
    setDraft(conversation.title)
    setEditing(true)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={draft}
          autoFocus
          className="h-9 flex-1 rounded-lg"
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
      <div className="group relative">
        <button
          type="button"
          className={cn(
            'flex h-9 w-full items-center rounded-lg px-2.5 text-left text-sm transition-colors',
            active
              ? 'bg-accent font-medium text-accent-foreground'
              : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground',
          )}
          onClick={() => onSelect(conversation.id)}
        >
          <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
        </button>

        {/* hover 时右侧渐隐遮罩，避免标题与操作按钮重叠 */}
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 w-16 rounded-r-lg bg-gradient-to-l to-transparent opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100',
            active ? 'from-accent' : 'from-accent/60',
          )}
        />

        <div className="absolute inset-y-0 right-1 flex items-center">
          {pending
            ? <Spinner className="mr-1.5 size-4 text-muted-foreground" />
            : (
                <ConversationActions
                  title={conversation.title}
                  onRename={startRename}
                  onDelete={() => setPendingDelete(true)}
                />
              )}
        </div>
      </div>

      <ConversationDeleteDialog
        title={conversation.title}
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        onConfirm={() => onDelete(conversation.id)}
      />
    </>
  )
}
