import type { CSSProperties } from 'react'
import type { TemplateStyleEnvironment } from './style-values'
import type { ColorValue, StyleValue, TemplateStyle } from './types'
import { resolveColor, resolveNumeric } from './style-values'

function numeric(
  property: keyof CSSProperties,
  unit: 'px' | 'number' = 'px',
  minimum = 0,
) {
  return (
    value: StyleValue,
    environment: TemplateStyleEnvironment,
  ): CSSProperties => {
    const bounded = Math.max(
      minimum,
      Math.min(resolveNumeric(value, environment), 4096),
    )

    return { [property]: unit === 'number' ? bounded : `${bounded}px` }
  }
}

function color(property: keyof CSSProperties) {
  return (
    value: ColorValue,
    environment: TemplateStyleEnvironment,
  ): CSSProperties => ({ [property]: resolveColor(value, environment) })
}

function literal(property: keyof CSSProperties) {
  return (value: string): CSSProperties => ({ [property]: value })
}

type StyleValues = {
  [Property in keyof TemplateStyle]-?: NonNullable<TemplateStyle[Property]>
}

type StyleResolvers = {
  [Property in keyof StyleValues]: (
    value: StyleValues[Property],
    environment: TemplateStyleEnvironment,
  ) => CSSProperties
}

/** 新增协议属性时必须明确其单位、边界与编码方式，不能落入隐式的数字分支。 */
const styleProperties: StyleResolvers = {
  fontSize: numeric('fontSize'),
  fontWeight: numeric('fontWeight', 'number'),
  lineHeight: numeric('lineHeight', 'number'),
  color: color('color'),
  backgroundColor: color('backgroundColor'),
  borderColor: color('borderColor'),
  borderWidth: numeric('borderWidth'),
  borderTopWidth: numeric('borderTopWidth'),
  borderRightWidth: numeric('borderRightWidth'),
  borderBottomWidth: numeric('borderBottomWidth'),
  borderLeftWidth: numeric('borderLeftWidth'),
  borderTopLeftRadius: numeric('borderTopLeftRadius'),
  borderTopRightRadius: numeric('borderTopRightRadius'),
  borderBottomLeftRadius: numeric('borderBottomLeftRadius'),
  borderBottomRightRadius: numeric('borderBottomRightRadius'),
  borderRadius: numeric('borderRadius'),
  borderStyle: literal('borderStyle'),
  letterSpacing: numeric('letterSpacing'),
  opacity: numeric('opacity', 'number'),
  padding: numeric('padding'),
  paddingTop: numeric('paddingTop'),
  paddingRight: numeric('paddingRight'),
  paddingBottom: numeric('paddingBottom'),
  paddingLeft: numeric('paddingLeft'),
  // margins 允许折角标题的局部偏移；其他尺寸不能产生负几何。
  marginTop: numeric('marginTop', 'px', -256),
  marginRight: numeric('marginRight', 'px', -256),
  marginBottom: numeric('marginBottom', 'px', -256),
  marginLeft: numeric('marginLeft', 'px', -256),
  gap: numeric('gap'),
  columnGap: numeric('columnGap'),
  rowGap: numeric('rowGap'),
  width: numeric('width'),
  height: numeric('height'),
  minWidth: numeric('minWidth'),
  maxWidth: numeric('maxWidth'),
  flexGrow: numeric('flexGrow', 'number'),
  flexShrink: numeric('flexShrink', 'number'),
  textAlign: literal('textAlign'),
  alignItems: literal('alignItems'),
  justifyContent: literal('justifyContent'),
  whiteSpace: literal('whiteSpace'),
  columns: (values) => ({
    gridTemplateColumns: values
      .map((column) => `minmax(0, ${column}fr)`)
      .join(' '),
  }),
  boxShadow: (shadow, environment) => ({
    boxShadow: `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${resolveColor(shadow.color, environment)}${Math.round(
      shadow.opacity * 255,
    )
      .toString(16)
      .padStart(2, '0')}`,
  }),
  // 几何外接框由渲染器处理，禁止把旋转藏进普通 CSS 布局。
  rotate: () => ({}),
}

export function resolveStyleProperty<Property extends keyof TemplateStyle>(
  property: Property,
  value: StyleValues[Property],
  environment: TemplateStyleEnvironment,
): CSSProperties {
  return styleProperties[property](value, environment)
}
