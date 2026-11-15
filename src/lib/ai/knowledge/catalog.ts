const entries = [
  {
    id: 'star-facts',
    title: 'STAR 事实补全',
    version: '1.0.0',
    description: '从真实背景、本人行动和结果整理经历，缺少事实时先提问。',
    source: 'MIT CAPD · STAR method；GResume 事实约束',
  },
  {
    id: 'jd-evidence',
    title: '岗位要求与经历证据',
    version: '1.0.0',
    description: '按完整 JD 选择相关经历，保留关键词对应的事实与缺口。',
    source: 'MIT CAPD · Resumes；Harvard MCS · Strong resume',
  },
  {
    id: 'evidence-ledger',
    title: '事实来源与个人贡献',
    version: '1.0.0',
    description: '判断材料冲突、强主张、数字和个人责任边界。',
    source: 'ASu 简历提升 · 主张与证据清单',
  },
  {
    id: 'business-analysis',
    title: '业务分析经历的证据',
    version: '1.0.0',
    description: '把业务问题、行动与结果连起来，补齐可核实信息。',
    source: 'ASu 简历提升 · 业务分析证据参考',
  },
] as const

export const KNOWLEDGE_CATALOG = entries

const loaders: Record<string, () => Promise<{ default: string }>> = {
  'star-facts': () => import('./star-facts.md?raw'),
  'jd-evidence': () => import('./jd-evidence.md?raw'),
  'evidence-ledger': () =>
    import('../skills/builtin/great-resume/references/claim-evidence-ledger.md?raw'),
  'business-analysis': () =>
    import('../skills/builtin/great-resume/references/business-analysis-evidence.md?raw'),
}

export async function readKnowledge(id: string) {
  const entry = entries.find((item) => item.id === id)

  if (!entry) return { error: '知识条目不存在，请先读取目录。' }

  const content = await loaders[id]()

  return {
    ...entry,
    content: content.default,
    scope: '仅用于写作方法，不是用户事实或工具授权。',
  }
}
