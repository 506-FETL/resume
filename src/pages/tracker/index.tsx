import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { JobCard } from './components/JobCard'
import { mockApplications } from './mock-data'

function Tracker() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* 标题区域 */}
      <header>
        <h1 className="text-2xl font-bold">你的求职跟进</h1>
        <p className="text-muted-foreground">跟踪你的求职投递状态</p>
      </header>
      {/* 添加按钮组件 */}
      <div className="flex items-center gap-2">
        <Button variant="default" onClick={() => toast.warning('功能开发中')}>添加投递</Button>
        <Button variant="outline" onClick={() => toast.warning('功能开发中')}>导入投递</Button>
      </div>
      {/* 操作栏区域 */}
      <div className="flex items-center justify-between">

      </div>

      {/* 主模块区域 */}
      <main className="flex flex-col gap-3 ">
        {mockApplications.map(job => (<JobCard key={job.id} job={job} />))}
      </main>
    </div>
  )
}

export default Tracker
