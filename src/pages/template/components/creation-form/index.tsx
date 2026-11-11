import type { useTemplateCreation } from '../../hooks/use-template-creation'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default function TemplateCreationForm({
  formId,
  creation,
  onCreate,
}: {
  formId: string
  creation: ReturnType<typeof useTemplateCreation>
  onCreate: () => void
}) {
  const { draft, patchDraft, loading, locked, ready } = creation
  const disabled = !ready || loading || locked

  return (
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault()

        if (ready && !loading) onCreate()
      }}
    >
      <FieldGroup className='gap-5'>
        <Field>
          <FieldLabel htmlFor={`${formId}-name`}>简历名称</FieldLabel>
          <Input
            id={`${formId}-name`}
            name='displayName'
            value={draft.displayName}
            placeholder='示例简历'
            maxLength={50}
            disabled={disabled}
            className='bg-background'
            onChange={(event) =>
              patchDraft({ displayName: event.target.value })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${formId}-description`}>
            描述（选填）
          </FieldLabel>
          <Textarea
            id={`${formId}-description`}
            name='description'
            value={draft.description}
            placeholder='例如：用于前端岗位投递'
            rows={4}
            maxLength={200}
            disabled={disabled}
            className='min-h-24 resize-y bg-background'
            onChange={(event) =>
              patchDraft({ description: event.target.value })
            }
          />
        </Field>
      </FieldGroup>
    </form>
  )
}
