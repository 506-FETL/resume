import type { useComposer } from '../use-composer'
import { AnimatePresence, motion } from 'motion/react'
import { DURATION, EASE } from '@/lib/motion'
import { Spinner } from '@/components/ui/spinner'
import { InputGroupButton } from '@/components/ui/input-group'

export function UploadTasks({
  uploads,
  reduceMotion,
}: Pick<ReturnType<typeof useComposer>, 'uploads' | 'reduceMotion'>) {
  return (
    <div className='space-y-1' aria-label='文件上传任务'>
      <AnimatePresence initial={false}>
        {uploads.tasks.map((task) => (
          <motion.div
            key={task.operationId}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              transition: { duration: reduceMotion ? 0 : DURATION.fast },
            }}
            transition={{
              duration: reduceMotion ? 0 : DURATION.base,
              ease: EASE.out,
            }}
            className='mb-2 flex items-center gap-2 text-xs'
          >
            {['preparing', 'reading', 'saving'].includes(task.status) && (
              <Spinner className='size-3' />
            )}
            <span className='min-w-0 flex-1 truncate'>
              {task.file.name} ·{' '}
              {task.status === 'preparing'
                ? '正在准备对话'
                : task.status === 'reading'
                  ? '正在读取文件'
                  : task.status === 'saving'
                    ? '正在保存原件'
                    : task.error}
            </span>
            {['failed', 'unknown'].includes(task.status) && (
              <InputGroupButton
                type='button'
                size='sm'
                onClick={() => uploads.retry(task)}
              >
                {task.status === 'unknown' ? '核对并重试' : '重试'}
              </InputGroupButton>
            )}
            <InputGroupButton
              type='button'
              size='sm'
              onClick={() => uploads.remove(task)}
            >
              移除
            </InputGroupButton>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
