/** 照片只随简历保存，不作为 AI 工具文本发送给模型。 */
export function serializeAiToolValue(value: unknown): string {
  return JSON.stringify(value, (key, item) =>
    key === 'photo' && item && typeof item === 'object' && 'dataUrl' in item
      ? undefined
      : item,
  )
}
