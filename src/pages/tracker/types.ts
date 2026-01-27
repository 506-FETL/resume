export type ApplicationStatus = 'saved' | 'applied' | 'screen' | 'interview' | 'offer' | 'rejected'

export interface JobApplication {
  id: string
  company: string // 公司名称
  position: string // 职位名称
  status: ApplicationStatus // 申请状态
  location: string // 工作地点
  appliedDate?: string // 投递日期
  savedDate: string // 保存日期
  // source: string // 投递渠道
  // salary?: string // 薪资范围
  companyLogo?: string // 公司 Logo URL
  notes?: string // 备注
  // createdAt: Date // 创建时间
  // updatedAt: Date // 更新时间
}
