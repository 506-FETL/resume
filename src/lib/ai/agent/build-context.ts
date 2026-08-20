import { resolveActiveResumeId } from '@/lib/ai/active-resume'
import { getResumeSchemaDoc } from '@/lib/ai/schema-doc'
import { listAccessibleResumes } from '@/lib/resume-access'
import { getCompanies } from '@/lib/supabase/resume'
import { getUserProfile } from '@/lib/supabase/user'

// 轻量用户概况（不含正文，注入 system 头，给 agent 基本盘感知）
export async function buildUserContext(): Promise<string> {
  const lines: string[] = []
  const today = new Date().toLocaleDateString('zh-CN')

  try {
    const profile = (await getUserProfile()) as { full_name?: string } | null
    lines.push(`当前用户：${profile?.full_name ?? '未设置昵称'}；今天：${today}。`)
  }
  catch {
    lines.push(`今天：${today}。`)
  }

  let accessibleResumes: Awaited<ReturnType<typeof listAccessibleResumes>> = []
  let resumeListLoaded = false
  try {
    accessibleResumes = await listAccessibleResumes()
    resumeListLoaded = true
    if (accessibleResumes.length > 0) {
      const list = accessibleResumes.slice(0, 10).map((resume, index) => {
        const storage = resume.storage === 'local' ? '本地' : '云端'
        return `#${index + 1}「${resume.display_name ?? '未命名'}」(${resume.type ?? 'unknown'}, ${storage}, resumeId=${resume.resume_id})`
      }).join('；')
      lines.push(`简历（共 ${accessibleResumes.length} 份）：${list}`)
    }
    else {
      lines.push('简历：用户还没有简历。')
    }
  }
  catch {
    // 忽略概况拉取失败
  }

  const currentId = resolveActiveResumeId()
  const currentResume = currentId
    ? accessibleResumes.find(resume => resume.resume_id === currentId)
    : null
  if (currentId && currentResume) {
    lines.push(`本对话正在操作：resumeId=${currentId}（${currentResume.display_name ?? '未命名'}，${currentResume.storage === 'local' ? '本地' : '云端'}）。修改简历字段/保存版本/恢复版本都会作用到这份简历。`)
  }
  else if (!currentId || resumeListLoaded) {
    lines.push('本对话还没有绑定简历（修改简历字段前需先用 open_resume 在本对话打开一份简历）。')
  }

  try {
    const jobs = await getCompanies()
    if (jobs.length > 0) {
      const byStatus = jobs.reduce<Record<string, number>>((acc, j) => {
        acc[j.status] = (acc[j.status] ?? 0) + 1
        return acc
      }, {})
      const dist = Object.entries(byStatus).map(([k, v]) => `${k}:${v}`).join(' / ')
      lines.push(`求职看板：共 ${jobs.length} 个职位（${dist}）`)
    }
    else {
      lines.push('求职看板：暂无职位。')
    }
  }
  catch {
    // 忽略概况拉取失败
  }

  lines.push('你可调用工具完整读写用户数据：读取任意简历内容/看板/ATS/派生血缘/历史版本；新建/删除/重命名简历、打开简历、修改当前简历字段；保存/恢复/删除简历历史版本；新增/修改/删除看板职位。所有写操作会先弹卡请用户确认。需要新建完整简历时用 create_resume（可带 sections 预填内容），不要回答"不支持创建简历"。')
  lines.push('')
  lines.push(getResumeSchemaDoc())
  return lines.join('\n')
}
