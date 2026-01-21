import type { ChangeEvent } from 'react'
import { Plus, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import useCurrentUser from '@/hooks/use-current-user'

function Header() {
  const navigate = useNavigate()
  const [greeting, setGreeting] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const auth = useCurrentUser()

  useEffect(() => {
    const hour = new Date().getHours()

    if (hour < 5)
      setGreeting('夜深了，注意休息')
    else if (hour < 11)
      setGreeting('早上好，开启美好的一天')
    else if (hour < 13)
      setGreeting('中午好，记得按时吃饭')
    else if (hour < 18)
      setGreeting('下午好，继续加油')
    else
      setGreeting('晚上好，享受闲暇时光')
  }, [])

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          欢迎回来
          {auth?.user_metadata.full_name ? `, ${auth.user_metadata.full_name}` : ''}
        </h1>
        <p className="text-muted-foreground text-sm">
          {greeting}
        </p>
      </div>
      <div className="flex items-center gap-2.5 w-full md:w-auto">
        <div className="relative hidden md:block w-56 group" ref={containerRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 transition-colors duration-200 group-focus-within:text-primary" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="搜索简历..."
            className="pl-9 h-9 text-sm bg-muted/30 border-transparent focus:bg-background focus:border-input transition-colors duration-200"
            value={searchValue}
            onChange={handleInputChange}
          />
        </div>
        <Button
          onClick={() => navigate('/resume')}
          variant="default"
          size="sm"
          className="h-9 px-4 shadow-sm"
        >
          <Plus className="size-4 mr-1.5" />
          新建简历
        </Button>
      </div>
    </div>
  )
}

export default Header
