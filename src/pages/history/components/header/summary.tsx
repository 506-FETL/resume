import { PageTitle } from '@/components/layout/page-layout'

export default function HistoryHeaderSummary() {
  return (
    <div className='min-w-0'>
      <PageTitle className='whitespace-nowrap'>历史版本</PageTitle>
      <p className='sr-only'>查看内容变化，保存并恢复关键版本。</p>
    </div>
  )
}
