import type { CanvasChangeAction, CanvasChangeCategory } from '../types'

export interface ToolCanvasMeta {
  category: CanvasChangeCategory
  action: CanvasChangeAction
  iconCategory: string // 供 tool-icons 取图标
  label: string
  targetTab?: 'resume' | 'board' | 'version'
}

// 单一来源：工具 → 画布分类/动作/图标/标题（替代 tool-call-part 内旧 TOOL_META）
export const TOOL_CANVAS_META: Record<string, ToolCanvasMeta> = {
  list_resume_knowledge: {
    category: 'read',
    action: 'read',
    iconCategory: 'documents',
    label: '读取写作资料目录',
  },
  read_resume_knowledge: {
    category: 'read',
    action: 'read',
    iconCategory: 'documents',
    label: '读取写作参考资料',
  },
  read_resume_preparation: {
    category: 'read',
    action: 'read',
    iconCategory: 'documents',
    label: '读取本机导入与修改证据',
  },
  search_experience_sources: {
    category: 'read',
    action: 'read',
    iconCategory: 'documents',
    label: '查找本轮职业档案',
  },
  read_experience_source: {
    category: 'read',
    action: 'read',
    iconCategory: 'documents',
    label: '读取经历原文',
  },
  activate_skill: {
    category: 'read',
    action: 'read',
    iconCategory: 'documents',
    label: '加载技能',
  },
  read_skill_resource: {
    category: 'read',
    action: 'read',
    iconCategory: 'documents',
    label: '读取技能参考资料',
  },
  list_resumes: {
    category: 'read',
    action: 'read',
    iconCategory: 'documents',
    label: '读取简历列表',
  },
  get_resume_detail: {
    category: 'read',
    action: 'read',
    iconCategory: 'documents',
    label: '读取简历内容',
  },
  update_current_resume_field: {
    category: 'resume',
    action: 'update',
    iconCategory: 'todos',
    label: '修改简历',
    targetTab: 'resume',
  },
  create_resume: {
    category: 'resume',
    action: 'create',
    iconCategory: 'documents',
    label: '新建简历',
    targetTab: 'resume',
  },
  update_resume_meta: {
    category: 'resume',
    action: 'update',
    iconCategory: 'todos',
    label: '修改简历信息',
    targetTab: 'resume',
  },
  delete_resume: {
    category: 'resume',
    action: 'delete',
    iconCategory: 'todos',
    label: '删除简历',
    targetTab: 'resume',
  },
  open_resume: {
    category: 'read',
    action: 'read',
    iconCategory: 'documents',
    label: '打开简历',
    targetTab: 'resume',
  },
  save_current_resume_version: {
    category: 'version',
    action: 'create',
    iconCategory: 'reminders',
    label: '保存历史版本',
    targetTab: 'version',
  },
  restore_current_resume_version: {
    category: 'version',
    action: 'restore',
    iconCategory: 'reminders',
    label: '恢复历史版本',
    targetTab: 'version',
  },
  delete_resume_version: {
    category: 'version',
    action: 'delete',
    iconCategory: 'reminders',
    label: '删除历史版本',
    targetTab: 'version',
  },
  list_resume_versions: {
    category: 'read',
    action: 'read',
    iconCategory: 'reminders',
    label: '读取历史版本',
    targetTab: 'version',
  },
  list_jobs: {
    category: 'read',
    action: 'read',
    iconCategory: 'goal_tracking',
    label: '读取求职看板',
    targetTab: 'board',
  },
  get_job: {
    category: 'read',
    action: 'read',
    iconCategory: 'goal_tracking',
    label: '读取职位详情',
    targetTab: 'board',
  },
  create_job: {
    category: 'board',
    action: 'create',
    iconCategory: 'goal_tracking',
    label: '新增职位',
    targetTab: 'board',
  },
  update_job: {
    category: 'board',
    action: 'update',
    iconCategory: 'goal_tracking',
    label: '修改职位',
    targetTab: 'board',
  },
  delete_job: {
    category: 'board',
    action: 'delete',
    iconCategory: 'goal_tracking',
    label: '删除职位',
    targetTab: 'board',
  },
  get_ats: {
    category: 'read',
    action: 'read',
    iconCategory: 'development',
    label: '读取 ATS 评分',
  },
  get_variant_tree: {
    category: 'read',
    action: 'read',
    iconCategory: 'memory',
    label: '读取派生血缘',
  },
  list_templates: {
    category: 'read',
    action: 'read',
    iconCategory: 'creative',
    label: '读取模板',
  },
  get_user_profile: {
    category: 'read',
    action: 'read',
    iconCategory: 'general',
    label: '读取用户资料',
  },
  get_current_time: {
    category: 'read',
    action: 'read',
    iconCategory: 'reminders',
    label: '获取当前时间',
  },
}
