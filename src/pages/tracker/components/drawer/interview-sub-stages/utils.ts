import type { InterviewSubStage } from '../../../types'

export function roundStatusLabel(round: InterviewSubStage) {
  if (round.is_history)
    return `历史 · ${round.status === '已完成' ? '已通过' : round.status === '已拒绝' ? '已结束' : '已记录'}`

  return round.status === '已完成'
    ? '已通过'
    : round.status === '已拒绝'
      ? '已结束'
      : round.status === '进行中'
        ? '进行中'
        : '已记录'
}
