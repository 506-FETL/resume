// 与简历编辑的在线保存保持一致；草稿立即更新，网络写入等待输入空闲。
export const WORKFLOW_SAVE_DELAY = 3000

export const sameValue = (left: unknown, right: unknown) =>
  Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right)
