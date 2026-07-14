/**
 * 把旧字符串上的光标偏移映射到「远端并发编辑后」的新字符串上的等价偏移。
 *
 * 用于读路径：当远端修改了当前聚焦的自由文本输入框时，`setValue` 会替换其值，
 * 受控 `<input>` 重渲染会把光标跳到末尾。此函数按「公共前缀 / 公共后缀」计算
 * 变更区间，将本地光标平移到语义等价的位置，从而在并发输入时保持光标不跳。
 *
 * 规则：
 * - 光标落在公共前缀内：不动。
 * - 光标落在公共后缀内：整体平移 `newStr.length - oldStr.length`。
 * - 光标落在被替换区间内：钳到新串被替换区间的边界。
 * 结果始终 clamp 到 `[0, newStr.length]`。
 */
export function mapCaretByDiff(oldStr: string, newStr: string, caret: number): number {
  if (oldStr === newStr) {
    return clamp(caret, 0, newStr.length)
  }

  const oldLen = oldStr.length
  const newLen = newStr.length
  const maxPrefix = Math.min(oldLen, newLen)

  // 最长公共前缀
  let pre = 0
  while (pre < maxPrefix && oldStr[pre] === newStr[pre]) {
    pre += 1
  }

  // 最长公共后缀（不与前缀在任一串上重叠）
  const maxSuffix = Math.min(oldLen - pre, newLen - pre)
  let suf = 0
  while (
    suf < maxSuffix
    && oldStr[oldLen - 1 - suf] === newStr[newLen - 1 - suf]
  ) {
    suf += 1
  }

  const delta = newLen - oldLen

  // 光标在公共前缀内：位置不变
  if (caret <= pre) {
    return clamp(caret, 0, newLen)
  }

  // 光标在公共后缀内：整体平移
  if (caret >= oldLen - suf) {
    return clamp(caret + delta, 0, newLen)
  }

  // 光标落在被替换区间内：钳到新串被替换区间边界
  const replacedEnd = newLen - suf
  const mapped = Math.min(caret, pre + Math.max(0, newLen - pre - suf))
  return clamp(mapped, pre, replacedEnd)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
