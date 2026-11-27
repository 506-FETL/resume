import { deferDialog } from '@/components/deferred-dialog'

export const CreateShareDialog = deferDialog(
  () => import('./index'),
  '新建分享',
)
