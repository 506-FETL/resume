import { historyComponent } from '../../utils/load-component'
import type { ComponentProps } from 'react'
import { deferDialog } from '@/components/deferred-dialog'
import type SaveForm from './content'

const DeferredSave = deferDialog(
  historyComponent(() => import('./content'), 'SaveVersionDialog'),
  '保存当前版本',
)

export default function SaveVersionDialog(
  props: ComponentProps<typeof SaveForm>,
) {
  return (
    <DeferredSave open={props.open} onClose={() => props.onOpenChange(false)}>
      {(Form, opener) => <Form {...props} returnFocusTo={opener} />}
    </DeferredSave>
  )
}
