import type { FormEvent } from 'react'
import type { VersionMetadataDraft } from '../../types'
import { Save } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import useHistoryStore from '../../store'
import { applyMetadataDraftPatch, createMetadataDraft } from '../../utils'
import VersionTagInput from '../shared/tag-input'

const EMPTY_DRAFT = createMetadataDraft()

interface SaveVersionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (versionId: number) => void
}

export default function SaveVersionDialog({ open, onOpenChange, onSaved }: SaveVersionDialogProps) {
  const { savingCurrent, saveCurrentVersion } = useHistoryStore()
  const [draft, setDraft] = useState<VersionMetadataDraft>(EMPTY_DRAFT)

  const handleClose = () => {
    if (!savingCurrent)
      onOpenChange(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const created = await saveCurrentVersion(draft)
    if (!created)
      return

    onSaved?.(created.id)
    onOpenChange(false)
  }

  const onChange = (patch: Partial<VersionMetadataDraft>) => {
    setDraft(current => applyMetadataDraftPatch(current, patch))
  }

  return (
    <Dialog open={open} onOpenChange={nextOpen => !nextOpen && handleClose()}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        onCloseAutoFocus={() => {
          if (!open)
            setDraft(EMPTY_DRAFT)
        }}
      >
        <DialogHeader>
          <DialogTitle>保存当前版本</DialogTitle>
          <DialogDescription>保存当前简历的内容，方便后续查看、对比和恢复。</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-6">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="version-name">版本名称</FieldLabel>
              <Input
                id="version-name"
                value={draft.versionName}
                placeholder="例如：项目优化版、字节投递版"
                maxLength={60}
                onChange={event => onChange({ versionName: event.target.value })}
              />
              <FieldDescription>为空时将自动显示为“版本 Vx”。</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="milestone-name">重点标记</FieldLabel>
              <Input
                id="milestone-name"
                value={draft.milestoneName}
                placeholder="例如：终版、春招投递版"
                maxLength={40}
                onChange={event => onChange({ milestoneName: event.target.value })}
              />
              <FieldDescription>给特别重要的一版做个标记，不填也没关系。</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="version-description">版本说明</FieldLabel>
              <Textarea
                id="version-description"
                value={draft.description}
                placeholder="记录本次保存的原因、用途或主要改动"
                rows={4}
                maxLength={240}
                onChange={event => onChange({ description: event.target.value })}
              />
              <FieldDescription>
                {draft.description.length}
                /240
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>标签</FieldLabel>
              <VersionTagInput value={draft.tags} onChange={tags => onChange({ tags })} />
              <FieldDescription>可添加多个标签，方便后续查找。</FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={savingCurrent}>取消</Button>
            <Button type="submit" disabled={savingCurrent}>
              <Save data-icon="inline-start" />
              {savingCurrent ? '保存中...' : '保存为新版本'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
