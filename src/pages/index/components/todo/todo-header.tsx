import { ListTodo } from 'lucide-react'
import { CardHeader, CardTitle } from '@/components/ui/card'

export function TodoHeader() {
  return (
    <CardHeader className="pb-4">
      <CardTitle className="text-sm font-medium flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-primary/8">
          <ListTodo className="size-4 text-primary" />
        </div>
        今日待办
      </CardTitle>
    </CardHeader>
  )
}
