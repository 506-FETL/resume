import type { ApplicationStatus, StageStatus } from './types'

// 下一步日期徽标配色（按 tone）
export const NEXT_ACTION_TONE_CLASSES: Record<'overdue' | 'today' | 'upcoming', string> = {
  overdue: 'bg-red-100 text-red-700',
  today: 'bg-orange-100 text-orange-700',
  upcoming: 'bg-muted text-muted-foreground',
}

// 看板列配置
export const BOARD_COLUMNS = [
  { status: 'saved' as ApplicationStatus, label: '已保存' },
  { status: 'applied' as ApplicationStatus, label: '已投递' },
  { status: 'screen' as ApplicationStatus, label: '筛选中' },
  { status: 'interview' as ApplicationStatus, label: '面试中' },
  { status: 'offer' as ApplicationStatus, label: '已录用' },
  { status: 'rejected' as ApplicationStatus, label: '已终止' },
]

// 阶段状态颜色配置（用于 drawer-stage-detail）
// 语义统一：待处理=灰、进行中=蓝、已完成=绿、已拒绝=红（与 STAGE_STATUS_CONFIG 一致）
export const STAGE_STATUS_COLORS: Record<StageStatus, { bg: string, text: string, border: string }> = {
  待处理: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  进行中: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  已完成: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
  已拒绝: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' },
}

// 申请状态配置
export const APPLICATION_STATUS_CONFIG: Record<ApplicationStatus, { label: string, color: string, bgColor: string }> = {
  saved: { label: '已保存', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  applied: { label: '已投递', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  screen: { label: '筛选中', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  interview: { label: '面试中', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  offer: { label: '已录用', color: 'text-green-600', bgColor: 'bg-green-100' },
  rejected: { label: '已终止', color: 'text-red-600', bgColor: 'bg-red-100' },
}

// 申请状态顺序（用于进度条）
export const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [
  'saved',
  'applied',
  'screen',
  'interview',
  'offer',
]

export const TRACKER_PRIMARY_ACTION_TEXT = '新增职位'

export const TRACKER_BATCH_TOOLBAR_LABEL = '批量工具'

export const TRACKER_NEXT_ACTION_LABELS: Record<ApplicationStatus, string> = {
  saved: '标记为已投递',
  applied: '推进到筛选中',
  screen: '推进到面试中',
  interview: '更新面试进展',
  offer: '查看完整记录',
  rejected: '查看复盘记录',
}

export const TRACKER_BOARD_COLUMN_HINTS: Record<ApplicationStatus, string> = {
  saved: '已保存但还未正式投递的岗位',
  applied: '已经完成投递，等待初筛反馈',
  screen: '正在进行简历筛选或沟通确认',
  interview: '进入面试流程，重点记录每轮反馈',
  offer: '拿到积极结果，关注决策与入职安排',
  rejected: '流程已结束，可回看原因与复盘',
}

// 阶段状态配置
export const STAGE_STATUS_CONFIG: Record<StageStatus, { label: string, color: string }> = {
  待处理: { label: '待处理', color: 'text-gray-500' },
  进行中: { label: '进行中', color: 'text-blue-500' },
  已完成: { label: '已完成', color: 'text-green-500' },
  已拒绝: { label: '已拒绝', color: 'text-red-500' },
}

// 阶段状态选项
export const STAGE_STATUS_OPTIONS: StageStatus[] = ['待处理', '进行中', '已完成', '已拒绝']

// 视图模式标签
export const VIEW_MODE_LABELS = {
  list: '列表',
  board: '看板',
}

// 默认面试子阶段模板
export const DEFAULT_INTERVIEW_SUB_STAGES: string[] = ['一面', '二面', '三面', 'HR面']

export const COMMON_COMPANIES = ['腾讯', '阿里巴巴', '字节跳动', '美团', '京东', '网易', '百度', '华为', '小米', '拼多多', '快手', '哔哩哔哩', '滴滴出行', '蚂蚁集团', '携程', '微软中国', '谷歌中国', 'OPPO', 'vivo', '荣耀', '联想', '中兴', '大疆', '商汤科技', '旷视科技', '地平线', '蔚来', '理想汽车', '小鹏汽车', '比亚迪', '小红书', '知乎', '微博', '陌陌', '虎牙', '斗鱼', '去哪儿', '58同城', '贝壳找房', '作业帮', '猿辅导', '得物', '叮咚买菜', '饿了么', '货拉拉', '七牛云', 'UCloud', '金山办公', 'SHEIN', 'Shopee']

export const COMMON_POSITIONS = ['前端开发工程师', '后端开发工程师', '全栈开发工程师', 'Java 开发工程师', 'Go 开发工程师', 'Python 开发工程师', 'C++ 开发工程师', 'iOS 开发工程师', 'Android 开发工程师', '大数据开发工程师', '数据分析师', '算法工程师', '机器学习工程师', 'NLP 工程师', 'CV 算法工程师', '推荐算法工程师', '运维工程师', 'DevOps 工程师', 'SRE 工程师', '云原生开发工程师', '嵌入式开发工程师', '安全工程师', '测试开发工程师', 'QA 工程师', '产品经理', 'UI 设计师', 'UX 设计师', '交互设计师', '项目经理', '技术经理', '架构师', 'DBA', '数据工程师', '游戏开发工程师', '音视频开发工程师', '区块链开发工程师']

export const COMMON_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '南京', '武汉', '西安', '苏州', '长沙', '重庆', '天津', '郑州', '合肥', '青岛', '厦门', '大连', '珠海', '东莞', '佛山', '无锡', '宁波', '福州', '昆明', '贵阳', '济南', '哈尔滨', '沈阳', '南昌', '海口', '太原', '石家庄', '兰州', '南宁']
