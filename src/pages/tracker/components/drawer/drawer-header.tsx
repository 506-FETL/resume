import type { JobApplication } from '../../types'
import { Briefcase, Building2, DollarSign, ExternalLink, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DrawerHeaderProps {
  job: JobApplication
  onEdit?: () => void
}
export function DrawerHeader({ job, onEdit }: DrawerHeaderProps) {
  return (
    <div className="space-y-4">
      {/* 公司名 + Logo + 职位 */}
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl">
        <div className="size-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
          {job.company_logo
            ? (
                <img src={job.company_logo} alt={job.company} className="size-8 object-contain" />
              )
            : (
                <Building2 className="size-6 text-primary-foreground" />
              )}
        </div>
        <div>
          <h2 className="font-semibold text-lg">{job.company}</h2>
          <p className="text-sm text-muted-foreground">{job.position}</p>
        </div>
      </div>
      {/* 详细信息网格 */}
      <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t">
        {/* 岗位 */}
        <div className="flex items-start gap-2">
          <Briefcase className="size-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-muted-foreground text-xs">岗位</p>
            <p>{job.position}</p>
          </div>
        </div>
        {/* Base 地 */}
        <div className="flex items-start gap-2">
          <MapPin className="size-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-muted-foreground text-xs">Base地</p>
            <p>{job.location}</p>
          </div>
        </div>
        {/* 薪资 */}
        <div className="flex items-start gap-2">
          <DollarSign className="size-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-muted-foreground text-xs">薪资</p>
            <p>{job.salary || '未填写'}</p>
          </div>
        </div>
        {/* JD 链接 */}
        <div className="flex items-start gap-2">
          <ExternalLink className="size-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-muted-foreground text-xs">JD官网</p>
            {job.job_url
              ? (
                  <a
                    href={job.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    查看职位详情
                  </a>
                )
              : (
                  <p>未填写</p>
                )}
          </div>
        </div>
      </div>
      {/* 编辑按钮 */}
      <Button variant="outline" size="sm" className="rounded-lg" onClick={onEdit}>
        编辑信息
      </Button>
    </div>
  )
}
