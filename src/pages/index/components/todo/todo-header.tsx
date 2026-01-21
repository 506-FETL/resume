import { ListTodo } from 'lucide-react'
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function TodoHeader() {
  return (
    <CardHeader className="pb-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/8">
              <ListTodo className="size-4 text-primary" />
            </div>
            今日待办
          </CardTitle>
          <CardDescription className="text-xs">
            保持简历活跃，提高求职成功率
          </CardDescription>
        </div>
      </div>
    </CardHeader>
  )
}
