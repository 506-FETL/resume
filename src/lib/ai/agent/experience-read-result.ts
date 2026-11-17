import type { ExperienceSourceBlock } from '@/lib/experience-sources/types'
import { estimateContextTokens } from './context-budget'

type ReadBudget = { tokens: number; bytes: number }

export type CitedExperienceBlock = ExperienceSourceBlock & {
  citationUrl: string
}

export type IndexedExperienceBlock = {
  index: number
  block: CitedExperienceBlock
}

export function measureReadResult(value: unknown): ReadBudget {
  const serialized = JSON.stringify(value)

  return {
    tokens: estimateContextTokens(serialized),
    bytes: new TextEncoder().encode(JSON.stringify(serialized)).byteLength,
  }
}

export function readResultFits(value: unknown, budget: ReadBudget) {
  const size = measureReadResult(value)

  return size.tokens <= budget.tokens && size.bytes <= budget.bytes
}

export function experienceRanges(entries: IndexedExperienceBlock[]) {
  const ranges: {
    fromBlock: number
    toBlock: number
    fromPage?: number
    toPage?: number
  }[] = []

  for (const { index, block } of entries) {
    const previous = ranges.at(-1)

    if (previous?.toBlock === index) {
      previous.toBlock = index + 1

      if (block.page) previous.toPage = block.page
    } else {
      ranges.push({
        fromBlock: index + 1,
        toBlock: index + 1,
        ...(block.page ? { fromPage: block.page, toPage: block.page } : {}),
      })
    }
  }

  return ranges
}

export function fitReadBlocks<T>(
  candidates: IndexedExperienceBlock[],
  build: (entries: IndexedExperienceBlock[]) => T,
  budget: ReadBudget,
): IndexedExperienceBlock[] {
  const used = measureReadResult(build([]))
  const selected: IndexedExperienceBlock[] = []

  for (const entry of candidates) {
    // 单段成本加独立范围成本是上界，避免每增加一段都序列化整份结果。
    const blockSize = measureReadResult(entry.block)
    const rangeSize = measureReadResult(experienceRanges([entry]))
    const tokens = used.tokens + blockSize.tokens + rangeSize.tokens
    const bytes = used.bytes + blockSize.bytes + rangeSize.bytes

    if (tokens > budget.tokens || bytes > budget.bytes) break

    selected.push(entry)
    used.tokens = tokens
    used.bytes = bytes
  }

  return selected.sort((a, b) => a.index - b.index)
}

export function findExperienceBlocks(
  blocks: CitedExperienceBlock[],
  query: string,
) {
  const phrase = query.toLocaleLowerCase()
  const keywords = phrase.split(/[\s,，、;；]+/u).filter(Boolean)
  const terms = [...new Set([phrase, ...keywords])]
  const hits = findMatchingBlocks(blocks, terms)

  const indexes = new Set<number>()

  for (const index of hits) {
    indexes.add(index)

    if (index > 0) indexes.add(index - 1)
    if (index + 1 < blocks.length) indexes.add(index + 1)
  }

  return {
    hits,
    candidates: [...indexes].map((index) => ({ index, block: blocks[index] })),
  }
}

function findMatchingBlocks(blocks: CitedExperienceBlock[], terms: string[]) {
  const hits: number[] = []
  const overlap = Math.max(...terms.map((term) => term.length)) - 1

  for (let first = 0; first < blocks.length; ) {
    let last = first

    while (
      last + 1 < blocks.length &&
      blocks[last].end === blocks[last + 1].start
    )
      last += 1

    // 只拼接原文偏移连续的硬切块；段落之间被略去的空白不能变成词组。
    const parts = blocks
      .slice(first, last + 1)
      .map((block) => block.text.toLocaleLowerCase())

    const text = parts.join('')
    let start = 0

    for (let index = first; index <= last; index += 1) {
      const end = start + parts[index - first].length
      const windowStart = Math.max(0, start - overlap)
      const window = text.slice(windowStart, end + overlap)

      const matched = terms.some((term) => {
        const position = window.indexOf(
          term,
          Math.max(0, start - windowStart - term.length + 1),
        )

        return position >= 0 && windowStart + position < end
      })

      if (matched) hits.push(index)

      start = end
    }

    first = last + 1
  }

  return hits
}

export function experiencePreview(blocks: CitedExperienceBlock[]) {
  const centers = [0, Math.floor((blocks.length - 1) / 2), blocks.length - 1]
  const indexes = new Set(centers)

  return {
    centers: new Set(centers),
    candidates: [...indexes].map((index) => ({ index, block: blocks[index] })),
  }
}
