import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCreationDraftStore } from '../../store'

export default function ResumeDetails({
  formId,
  busy,
  onSubmit,
}: {
  formId: string
  busy: boolean
  onSubmit: () => void
}) {
  const draft = useCreationDraftStore((state) => state.draft)
  const patch = useCreationDraftStore((state) => state.patch)
  const locked = busy || Boolean(draft.creation)
  const displayName = draft.creation?.displayName ?? draft.displayName

  const description = draft.creation
    ? (draft.creation.description ?? '')
    : draft.description

  return (
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault()

        if (!busy) onSubmit()
      }}
    >
      <FieldGroup className='gap-5'>
        <Field>
          <FieldLabel htmlFor={`${formId}-name`}>简历名称</FieldLabel>
          <Input
            id={`${formId}-name`}
            name='displayName'
            value={displayName}
            placeholder='示例简历'
            maxLength={50}
            disabled={locked}
            className='bg-background'
            onChange={(event) => patch({ displayName: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${formId}-description`}>
            描述（选填）
          </FieldLabel>
          <Textarea
            id={`${formId}-description`}
            name='description'
            value={description}
            placeholder='例如：用于前端岗位投递'
            rows={4}
            maxLength={200}
            disabled={locked}
            className='min-h-24 resize-y bg-background'
            onChange={(event) => patch({ description: event.target.value })}
          />
        </Field>
      </FieldGroup>
    </form>
  )
}
