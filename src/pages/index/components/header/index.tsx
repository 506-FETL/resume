import type { MouseEventHandler } from 'react'
import { PageHeader } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  createDisabled?: boolean
  onCreate: MouseEventHandler<HTMLButtonElement>
}

function Header({ onCreate, createDisabled }: HeaderProps) {
  return (
    <PageHeader
      title='首页'
      actions={
        <Button
          aria-label='打开创建简历表单'
          onClick={onCreate}
          disabled={createDisabled}
        >
          创建简历
        </Button>
      }
    />
  )
}

export default Header
