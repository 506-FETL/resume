/** SVG 仅允许数值几何指令，不接受标记、外链或不完整的路径。 */
export function isSafeTemplatePath(path: string): boolean {
  const tokens = path.match(/[a-z]|[+-]?(?:\d*\.\d+|\d+\.?\d*)/gi)
  if (!tokens?.length || tokens[0].toLowerCase() !== 'm')
    return false
  const remainder = path.replace(/[a-z]|[+-]?(?:\d*\.\d+|\d+\.?\d*)/gi, '').replace(/[\s,]/g, '')
  if (remainder)
    return false
  const arity: Record<string, number> = { m: 2, z: 0, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7 }
  let index = 0
  while (index < tokens.length) {
    const command = tokens[index++].toLowerCase()
    if (!Object.hasOwn(arity, command))
      return false
    const values: number[] = []
    while (index < tokens.length && !/^[a-z]$/i.test(tokens[index])) {
      const value = Number(tokens[index++])
      if (!Number.isFinite(value) || Math.abs(value) > 4096)
        return false
      values.push(value)
    }
    const count = arity[command]
    if (count === 0 ? values.length !== 0 : values.length === 0 || values.length % count !== 0)
      return false
    if (command === 'a') {
      for (let offset = 0; offset < values.length; offset += 7) {
        if (values[offset] < 0 || values[offset + 1] < 0 || ![0, 1].includes(values[offset + 3]) || ![0, 1].includes(values[offset + 4]))
          return false
      }
    }
  }
  return true
}
