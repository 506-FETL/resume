import { deferDialog } from '@/components/deferred-dialog'
import type { ExperienceUploadDialogProps } from '../upload-dialog/types'

const UploadDialog = deferDialog<ExperienceUploadDialogProps>(
  () =>
    import('../upload-dialog').then(({ ExperienceUploadDialog }) => ({
      default: ExperienceUploadDialog,
    })),
  '添加职业档案',
)

export function DeferredExperienceUploadDialog(
  props: ExperienceUploadDialogProps,
) {
  return (
    <UploadDialog
      open={props.open}
      onClose={() => props.onOpenChange(false)}
      loadingTitle={props.sourceId ? '上传新版本' : '添加职业档案'}
    >
      {(Content, trigger) => <Content {...props} returnFocusTo={trigger} />}
    </UploadDialog>
  )
}
