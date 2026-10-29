import type { MouseEventHandler } from 'react'
import { PageHeader } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  focus?: string
  isGettingStarted?: boolean
  onCreate: MouseEventHandler<HTMLButtonElement>
}

function Header({ focus, onCreate, isGettingStarted }: HeaderProps) {
  return (
    <PageHeader
      title='首页'
      description={
        focus ||
        (isGettingStarted
          ? '创建或导入简历，从已有内容开始。'
          : '继续编辑简历，查看待办与求职进展。')
      }
      actions={
        <Button aria-label='打开创建简历表单' onClick={onCreate}>
          创建简历
        </Button>
      }
    />
  )
}

export default Header
