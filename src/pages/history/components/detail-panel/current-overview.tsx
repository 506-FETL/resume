import useHistoryStore from '../../store'

export default function CurrentOverview() {
  const currentResume = useHistoryStore((state) => state.currentResume)

  if (!currentResume) {
    return null
  }

  return (
    <dl className='min-w-0'>
      <dt className='text-xs text-muted-foreground'>简历说明</dt>
      <dd className='mt-1.5 break-words text-sm leading-6'>
        {currentResume.description || (
          <span className='text-muted-foreground'>暂无说明</span>
        )}
      </dd>
    </dl>
  )
}
