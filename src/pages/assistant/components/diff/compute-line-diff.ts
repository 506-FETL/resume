export interface DiffLine {
  type: 'context' | 'add' | 'remove'
  text: string
}

export interface DiffStatValue {
  additions: number
  deletions: number
}

// 把任意值规范为文本行
export function toLines(value: unknown): string[] {
  if (value == null)
    return ['（空）']
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  if (text === '')
    return ['（空）']
  return text.split('\n')
}

// 经典 LCS 行级 diff：输出 remove（旧独有）+ add（新独有）+ context（共有）
export function computeLineDiff(before: unknown, after: unknown): DiffLine[] {
  const a = toLines(before)
  const b = toLines(after)
  const m = a.length
  const n = b.length
  // dp[i][j] = LCS(a[i:], b[j:]) 长度
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const lines: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      lines.push({ type: 'context', text: a[i] })
      i++
      j++
    }
    else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ type: 'remove', text: a[i] })
      i++
    }
    else {
      lines.push({ type: 'add', text: b[j] })
      j++
    }
  }
  while (i < m) {
    lines.push({ type: 'remove', text: a[i] })
    i++
  }
  while (j < n) {
    lines.push({ type: 'add', text: b[j] })
    j++
  }
  return lines
}

export function diffStat(lines: DiffLine[]): DiffStatValue {
  return {
    additions: lines.filter(l => l.type === 'add').length,
    deletions: lines.filter(l => l.type === 'remove').length,
  }
}
