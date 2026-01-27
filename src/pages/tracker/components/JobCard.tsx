import type { JobApplication } from '../types'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { StatusLine } from './StatusLine'

// 创建主模块组件
interface JobCardProps {
  job: JobApplication
}
// {job}的作用是直接解构传入的props，获取其中的job对象
export function JobCard({ job }: JobCardProps) {
  return (
    <Card className="flex flex-row items-center gap-4 p-4 ">
      {/* 公司Logo 站位 */}
      <div className="size-12 rounded-lg bg-muted flex items-center justify-center">
        {/* <span className="text-lg font-bold">{job.company[0]}</span> */}
        <img src={job.companyLogo} />
      </div>
      {/* 职位信息 */}
      <div className="flex-1">
        <h3>{job.position}</h3>
        <p>
          {job.company}
          {' '}
          •
          {' '}
          {job.location}
        </p>
      </div>
      {/* 状态标签 */}
      <Badge variant="outline">{ job.status.toUpperCase()}</Badge>
      <StatusLine currentStatus={job.status} />
    </Card>
  )
}
