/** 仅用于流式预览：读取根对象数组中已完整闭合的对象项，不修补未完成的字段。 */
export function parseCompletedJsonArrayItems(value: string, property: string): unknown[] {
  const start = value.indexOf('{')
  if (start < 0)
    return []

  const stack: string[] = []
  let inString = false
  let escaped = false
  let itemEnd = 0
  let rootEnd = 0

  for (let i = start; i < value.length; i++) {
    const char = value[i]
    if (inString) {
      if (escaped) {
        escaped = false
      }
      else if (char === '\\') {
        escaped = true
      }
      else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
    }
    else if (char === '{' || char === '[') {
      stack.push(char)
    }
    else if (char === '}' || char === ']') {
      if (stack.pop() !== (char === '}' ? '{' : '['))
        break

      if (char === '}' && stack.length === 2 && stack[0] === '{' && stack[1] === '[') {
        itemEnd = i + 1
      }
      if (stack.length === 0) {
        rootEnd = i + 1
        break
      }
    }
  }

  if (!rootEnd && !itemEnd)
    return []

  // 仅为完整记录补上外层容器，丢弃仍在传输的下一条；最终结果不得走此路径。
  const candidate = rootEnd
    ? value.slice(start, rootEnd)
    : `${value.slice(start, itemEnd)}]}`
  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>
    return Array.isArray(parsed[property]) ? parsed[property] : []
  }
  catch {
    // 分片不是完整 JSON 属于正常传输状态，不记录解析错误。
    return []
  }
}
