import type { ColorToken, ColorValue, NumericToken, StyleValue } from './types'

export interface TemplateStyleEnvironment {
  numbers: Record<NumericToken, number>
  colors: Record<ColorToken, string>
  fontFamily: string
}
export function resolveNumeric(
  value: StyleValue,
  environment: TemplateStyleEnvironment,
): number {
  return typeof value === 'number'
    ? value
    : environment.numbers[value.token] * (value.factor ?? 1) + (value.add ?? 0)
}
export function resolveColor(
  value: ColorValue,
  environment: TemplateStyleEnvironment,
): string {
  return typeof value === 'string' ? value : environment.colors[value.token]
}
