export const fieldMetrics = { description: 16.5, date: 10, role: 17 } as const

export const demoRoles = ['design', 'frontend'] as const

export type DemoRole = (typeof demoRoles)[number]

export const storyExamples = {
  design: {
    tab: '产品设计',
    version: '产品设计版',
    job: '产品设计师',
    project: {
      name: '退款页面改版',
      original: '参与退款页面的交互设计。',
      period: '2025.03–05',
      skills: 'Figma · 交互设计',
    },
    responsibility: '交互设计',
    requirement: '设计退款页面，让客服能看清最多能退多少钱。',
    covered: '退款页面',
    missing: '能退多少钱',
    finding: '页面改了哪里，客服用起来有什么不同？',
    repair: '写清退款页面改了哪里',
    brief:
      '我把要退多少钱、最多能退多少放在一起。填多了，就在旁边提醒多填了多少。',
    lines: ['并列展示申请金额与可退金额。', '设计退款金额校验提示。'],
    jointLine: '设计超额提示，标明超出金额。',
  },
  frontend: {
    tab: '前端开发',
    version: '前端开发版',
    job: '前端工程师',
    project: {
      name: '仓库盘点页面',
      original: '参与仓库盘点页面开发。',
      period: '2025.07–09',
      skills: 'TypeScript · 离线存储',
    },
    responsibility: '前端开发',
    requirement: '做一个盘点页面，没网也能录入，有网后再上传。',
    covered: '盘点页面',
    missing: '没网时怎么保存',
    finding: '仓库没网的时候，填好的数据会不会丢？',
    repair: '写清没网时怎么保存数据',
    brief:
      '仓库没网的时候，先把货品编号和数量存在设备里。有网了再传，已经传过的就不重复传。',
    lines: ['实现盘点数据的离线存储。', '支持联网后同步盘点数据。'],
    jointLine: '联网后同步数据，避免重复提交。',
  },
} as const
