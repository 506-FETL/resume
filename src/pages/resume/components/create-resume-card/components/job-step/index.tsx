import { ContentSkeleton } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import { jobContextUrl, useJobContextStore } from '@/lib/job-context'
import useResumeListStore from '@/pages/resume/store'
import useUserStore from '@/store/user'
import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { CreationStep } from '../../types'

export function CreationJob({
  go,
  onClose,
}: {
  go: (next: CreationStep) => void
  onClose: () => void
}) {
  const user = useUserStore((state) => state.currentUser)
  const jobContext = useJobContextStore((state) => state.context)
  const navigate = useNavigate()
  const list = useResumeListStore()
  const listLoading = list.libraryOptionsLoading
  const listError = list.libraryOptionsError
  const loadOptions = list.loadLibraryOptions

  const resumes =
    list.libraryAccountId === (user?.id ?? null) ? list.libraryOptions : []

  return (
    <div className='space-y-3'>
      <p className='text-sm text-muted-foreground'>
        选择原简历，生成岗位定制版本。
      </p>
      {listLoading ? (
        <ContentSkeleton label='正在读取简历选项' rows={3} className='px-0' />
      ) : listError ? (
        <div role='alert' className='space-y-2 text-sm'>
          <p>简历列表暂时没有加载成功。</p>
          <Button variant='outline' onClick={() => loadOptions(true)}>
            重新加载
          </Button>
        </div>
      ) : (
        resumes
          .filter((resume) => resume.derived_status !== 'generating')
          .map((resume) => (
            <Button
              key={resume.resume_id}
              variant='outline'
              className='w-full justify-between'
              onClick={() => {
                if (jobContext && !jobContext.jdText.trim()) {
                  toast.info('请先返回岗位补充 JD 原文')

                  return
                }

                useResumeListStore.getState().openDeriveFor(resume.resume_id)

                onClose()

                navigate(
                  jobContext
                    ? jobContextUrl('/resume', jobContext.id)
                    : '/resume',
                )
              }}
            >
              <span className='truncate'>
                {resume.display_name || '未命名简历'}
              </span>
              <ArrowRight className='size-4 shrink-0' />
            </Button>
          ))
      )}
      {!listLoading && !listError && resumes.length === 0 && (
        <>
          <p className='text-sm'>先准备一份简历，再带入目标岗位。</p>
          <Button variant='outline' onClick={() => go('import')}>
            导入旧简历
          </Button>
          <Button variant='ghost' onClick={() => go('profile')}>
            从零开始
          </Button>
        </>
      )}
    </div>
  )
}
