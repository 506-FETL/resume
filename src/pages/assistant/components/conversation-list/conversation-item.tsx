import type { AiConversation } from '@/lib/ai/types'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
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
          className="h-9 flex-1"
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
        <Button
          variant={active ? 'secondary' : 'ghost'}
          className="h-9 w-full justify-start gap-2 pr-9 font-normal"
          onClick={() => onSelect(conversation.id)}
        >
          <span className="min-w-0 flex-1 truncate text-left">{conversation.title}</span>
        </Button>
        <div className="absolute top-1/2 right-1 -translate-y-1/2">
          {pending
            ? <Spinner className="mr-2 size-4 text-muted-foreground" />
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
