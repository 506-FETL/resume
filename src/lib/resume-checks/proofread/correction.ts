import { findCheckTerms } from '../terms'
import type { CheckTarget } from '../types'
import type { ModelIssue } from './contract'
import { invalidResult } from './contract'
import {
  COMMON_ENGLISH_WORDS,
  ENGLISH_SPELLING_CORRECTIONS,
  KNOWN_TECHNICAL_TERMS,
} from './lexicon'

export function editDistanceWithinTwo(before: string, after: string): number {
  if (Math.abs(before.length - after.length) > 2) return 3

  let previous = Array.from({ length: after.length + 1 }, (_, index) => index)

  for (let i = 0; i < before.length; i++) {
    const current = [i + 1]

    for (let j = 0; j < after.length; j++) {
      current.push(
        Math.min(
          current[j] + 1,
          previous[j + 1] + 1,
          previous[j] + (before[i] === after[j] ? 0 : 1),
        ),
      )
    }

    previous = current
  }

  return previous[after.length]
}

export function validateCorrection(
  issue: ModelIssue,
  fields: CheckTarget[],
): boolean {
  const { quote, replacement, category } = issue

  const hasUnsafeCharacters =
    /[\d<>[\]{}年月日一二三四五六七八九十百千万亿零〇]/

  const responsibilityWords =
    /负责|参与|主导|协助|支持|主持|管理|领导|独立|熟悉|熟练|精通|擅长|提升|降低|增长|优化|开发|维护|搭建|设计|完成|推动|统筹|\b(?:lead|led|manage|own|assist|support|expert|proficient|improve|increase|reduce)\b/i

  if (
    !quote.trim() ||
    !replacement.trim() ||
    quote !== quote.trim() ||
    replacement !== replacement.trim() ||
    quote === replacement ||
    quote.length > 40 ||
    replacement.length > 40 ||
    hasUnsafeCharacters.test(quote + replacement) ||
    [...(quote + replacement)].some(
      (character) => character.charCodeAt(0) < 32,
    ) ||
    responsibilityWords.test(quote + replacement)
  ) {
    invalidResult()
  }

  if (category === 'text_consistency') {
    const normalize = (text: string) => text.toLowerCase().replace(/[.\s]/g, '')

    if (
      !/[a-z]/i.test(quote) ||
      !/^[a-z.\s+#-]+$/i.test(quote + replacement) ||
      normalize(quote) !== normalize(replacement) ||
      !fields.some((field) => field.quote.includes(replacement))
    ) {
      invalidResult()
    }

    return true
  }

  const distance = editDistanceWithinTwo(
    quote.toLowerCase(),
    replacement.toLowerCase(),
  )

  if (category === 'technical_term') {
    const normalized = (value: string) =>
      value.toLowerCase().replace(/[.\s]/g, '')

    const knownTypo = findCheckTerms(quote).some(
      (term) => term.from === quote && term.to === replacement,
    )

    if (
      !KNOWN_TECHNICAL_TERMS.has(replacement) ||
      distance > 2 ||
      (!knownTypo && normalized(quote) !== normalized(replacement))
    )
      invalidResult()

    return true
  }

  if (category === 'english_spelling') {
    if (
      !/^[a-z]+$/.test(quote + replacement) ||
      COMMON_ENGLISH_WORDS.has(quote) ||
      ENGLISH_SPELLING_CORRECTIONS.get(quote) !== replacement ||
      quote.length < 3
    ) {
      invalidResult()
    }

    return true
  }

  if (
    !/^[\u3400-\u9fff]+$/.test(quote + replacement) ||
    quote.length < 2 ||
    quote.length > 12 ||
    quote.length !== replacement.length ||
    distance !== 1
  ) {
    invalidResult()
  }

  return findCheckTerms(quote).some(
    (term) => term.from === quote && term.to === replacement,
  )
}
