export interface CheckTerm {
  from: string
  to: string
  kind: 'term' | 'spelling'
  style?: boolean
}

// 只列可明确解释的拼写；不对陌生公司、项目名做编辑距离匹配。
const terms: CheckTerm[] = [
  ...[
    ['Javscript', 'JavaScript'],
    ['JavaScirpt', 'JavaScript'],
    ['JavaSript', 'JavaScript'],
    ['TypeScirpt', 'TypeScript'],
    ['Kubernets', 'Kubernetes'],
    ['Kuberentes', 'Kubernetes'],
    ['Pyhton', 'Python'],
    ['Ptyhon', 'Python'],
    ['Sring Boot', 'Spring Boot'],
  ].map(([from, to]) => ({ from, to, kind: 'term' as const })),
  ...[
    ['Javascript', 'JavaScript'],
    ['javascript', 'JavaScript'],
    ['Typescript', 'TypeScript'],
    ['typescript', 'TypeScript'],
    ['Github', 'GitHub'],
    ['github', 'GitHub'],
    ['Mysql', 'MySQL'],
    ['mysql', 'MySQL'],
    ['MySql', 'MySQL'],
    ['Postgresql', 'PostgreSQL'],
    ['PostgreSql', 'PostgreSQL'],
    ['Nodejs', 'Node.js'],
    ['NodeJS', 'Node.js'],
    ['Reactjs', 'React'],
    ['Springboot', 'Spring Boot'],
  ].map(([from, to]) => ({ from, to, kind: 'term' as const, style: true })),
  ...[
    ['熟练撑握', '熟练掌握'],
    ['沟通协做', '沟通协作'],
    ['团队协做', '团队协作'],
    ['技术文挡', '技术文档'],
    ['开发文挡', '开发文档'],
    ['数据分折', '数据分析'],
    ['性能优话', '性能优化'],
    ['系统架够', '系统架构'],
    ['需球分析', '需求分析'],
    ['独挡一面', '独当一面'],
  ].map(([from, to]) => ({ from, to, kind: 'spelling' as const })),
]

export interface TermMatch extends CheckTerm {
  occurrence: number
}

export function isCheckTermStyleChange(from: string, to: string): boolean {
  return terms.some(
    (term) => term.style && term.from === from && term.to === to,
  )
}

function inCodeOrCommand(text: string, position: number, length: number) {
  for (const match of text.matchAll(/(`+)[\s\S]*?\1/g)) {
    if (position >= match.index && position < match.index + match[0].length)
      return true
  }

  const before =
    text
      .slice(0, position)
      .split(/[\n。；;!?！？]/)
      .at(-1) ?? ''

  const after = text.slice(position + length).split(/[\n。；;!?！？]/)[0]
  const sentence = before + text.slice(position, position + length) + after

  return (
    /命令|终端|脚本|命令行|运行|执行|\b(?:shell|bash|zsh|powershell|cli)\b/i.test(
      sentence,
    ) ||
    /(?:^|\s)[$>]\s*$/.test(before) ||
    /^\s+--?[A-Za-z]/.test(after)
  )
}

export function findCheckTerms(text: string, raw?: string): TermMatch[] {
  // 含代码块的富文本采用保守策略，避免改写语言关键字、命令或标识符。
  if (raw && /<(?:code|pre)\b/i.test(raw)) return []

  return terms.flatMap((term) => {
    const matches: TermMatch[] = []
    let start = 0
    let occurrence = 0

    while (start < text.length) {
      const position = text.indexOf(term.from, start)

      if (position < 0) break

      const before = text[position - 1] ?? ''
      const after = text[position + term.from.length] ?? ''
      const tokenPart = /[A-Za-z0-9_$+.#/@-]/

      const bounded =
        term.kind === 'spelling' ||
        (!tokenPart.test(before) && !tokenPart.test(after))

      if (bounded && !inCodeOrCommand(text, position, term.from.length))
        matches.push({ ...term, occurrence })

      occurrence += 1
      start = position + term.from.length
    }

    return matches
  })
}
