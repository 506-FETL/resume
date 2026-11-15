import { Plus } from 'lucide-react'
import { useState } from 'react'
import AnimatedContent from '@/components/motion/animated-content'
import { PageHeader } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import useShareStore from '../../store'
import CreateDialog from '../create-dialog'
import Overview from '../overview'

export default function Header() {
  const {
    resumeMap,
    resumeOptionsLoaded,
    resumeOptionsLoading,
    resumeOptionsError,
    reloadResumeOptions,
  } = useShareStore()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const canCreate = Object.keys(resumeMap).length > 0

  return (
    <>
      <div className='space-y-2'>
        <PageHeader
          title='分享管理'
          actions={
            <Button
              className='h-9 shrink-0 px-3 text-xs sm:text-sm'
              data-share-dialog-fallback=''
              onClick={() => setCreateDialogOpen(true)}
              disabled={!canCreate}
              title={
                canCreate
                  ? undefined
                  : resumeOptionsError
                    ? '简历列表暂不可用'
                    : resumeOptionsLoaded
                      ? '请先创建或同步一份云端简历'
                      : '正在加载简历列表'
              }
            >
              <Plus data-icon='inline-start' />
              新建分享
            </Button>
          }
        />
        <Overview />
        <AnimatedContent animationKey={resumeOptionsError ? 'error' : 'ready'}>
          {resumeOptionsError && (
            <div
              role='alert'
              className='flex items-center gap-3 text-sm text-muted-foreground'
            >
              <span>简历列表加载失败，已有分享仍可查看。</span>
              <Button
                variant='outline'
                size='sm'
                disabled={resumeOptionsLoading}
                onClick={() => reloadResumeOptions()}
              >
                重试简历列表
              </Button>
            </div>
          )}
        </AnimatedContent>
      </div>
      <CreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  )
}
