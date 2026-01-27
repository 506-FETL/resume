// 创建进度条组件
import type { ApplicationStatus } from '../types'
import { cn } from '@/lib/utils' // 用来合并className

const STATUS_STEPS: ApplicationStatus[] = ['saved', 'applied', 'screen', 'interview', 'offer']
// Record是TS工具类，定义变量类型是一个键值对 key为ApplicationStatus value为string类型
// const STATUS_LABELS: Record<ApplicationStatus, string> = {
//   saved: '已保存',
//   applied: '已投递',
//   screen: '已筛选',
//   interview: '已面试',
//   offer: '已offer',
// }

// 定义line组件的props类型
interface StatusLineProps {
  currentStatus: ApplicationStatus
}
// 状态进度组件 这里的currentStatus是从外部传入的props
export function StatusLine({ currentStatus }: StatusLineProps) {
  // 获取当前状态在数组中的索引
  const currentIndex = STATUS_STEPS.indexOf(currentStatus)
  return (
    <div className="flex items-center">
      {/* 遍历step数组，定义各个节点 */}

      {STATUS_STEPS.map((status, index) => (

        <div key={status} className="flex items-center">
          {/* 定义节点原点 索引小于等于当前状态索引的节点 显示为实心 */}
          <div className={cn('size-3 rounded-full border-2', index <= currentIndex ? 'bg-primary border-primary' : 'bg-muted border-muted',
          )}
          />
          {/* 定义连接线 （非最后一个节点） */}
          {/* 如果遍历的节点小于当前索引状态，那么连接线高亮 */}
          {index < STATUS_STEPS.length - 1 && (<div className={cn('w-12 h-0.5', index < currentIndex ? 'bg-primary' : 'bg-muted')} />)}
        </div>
      ))}
    </div>
  )
}
