export const fieldMetrics = { description: 16.5, date: 10, role: 17 } as const

export const demoRoles = ['design', 'frontend'] as const

export type DemoRole = (typeof demoRoles)[number]

export const storyExamples = {
  design: {
    tab: '产品设计',
    version: '产品设计版',
    job: '产品设计师',
    project: {
      name: '退款审核台改版',
      original: '参与退款审核台改版。',
      period: '2025.03–05',
      skills: 'Figma · 交互原型',
    },
    responsibility: '交互设计',
    requirement: '负责退款审核台的交互设计，理顺金额核对流程。',
    covered: '退款审核台',
    missing: '金额核对',
    finding: '客服原先怎么核对金额？改版后呢？',
    repair: '写清客服怎样核对退款金额',
    brief:
      '我用 Figma 画了审核原型，把申请额和可退余额排在一行。申请超额时，就在金额右边标出多了多少。',
    lines: ['把申请额和可退余额排在一行。', '申请超额时提醒客服。'],
    jointLine: '申请超额时，在右侧标出差额。',
  },
  frontend: {
    tab: '前端开发',
    version: '前端开发版',
    job: '前端工程师',
    project: {
      name: '仓库移动盘点表',
      original: '参与开发移动盘点表。',
      period: '2025.07–09',
      skills: 'TypeScript · IndexedDB',
    },
    responsibility: '前端开发',
    requirement: '开发移动盘点表，支持离线录入，联网后能补传。',
    covered: '移动盘点表',
    missing: '离线录入',
    finding: '仓库里断了网，刚扫过的货还能找回来吗？',
    repair: '写清断网后怎样保住盘点记录',
    brief:
      '我用 IndexedDB 把条码和数量存在本机。恢复网络后按记录编号补传，已经传过的就跳过。',
    lines: ['断网时把条码和数量存到本机。', '联网后自动补传。'],
    jointLine: '重连后按记录编号去重补传。',
  },
} as const
