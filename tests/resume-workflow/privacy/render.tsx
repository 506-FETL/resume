import { createRoot } from 'react-dom/client'
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { MotionProvider } from '@/components/motion/motion-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import ResumeSharePage from '@/pages/share/view'
import useUserStore from '@/store/user'
import '@/index.css'

useUserStore.getState().setCurrentUser(null)

function Fixture() {
  const navigate = useNavigate()
  const { token = 'both--short' } = useParams()
  const [mode, length] = token.split('--')

  return (
    <>
      <aside
        className='fixed right-2 bottom-2 z-50 flex max-w-[calc(100%-1rem)] flex-wrap gap-1 rounded-lg border bg-background p-2 text-xs shadow-md print:hidden'
        aria-label='隔离验收控制'
      >
        {[
          ['phone', '隐藏电话'],
          ['email', '隐藏邮箱'],
          ['both', '都隐藏'],
          ['show', '都显示'],
          ['empty', '原空字段'],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={mode === value ? 'default' : 'outline'}
            size='sm'
            onClick={() => navigate(`/share/${value}--${length}`)}
          >
            {label}
          </Button>
        ))}
        {[
          ['short', '短内容'],
          ['boundary', '临界内容'],
          ['long', '多页内容'],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={length === value ? 'default' : 'outline'}
            size='sm'
            onClick={() => navigate(`/share/${mode}--${value}`)}
          >
            {label}
          </Button>
        ))}
      </aside>
      <ResumeSharePage />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <MotionProvider>
      <TooltipProvider>
        <MemoryRouter initialEntries={['/share/both--short']}>
          <Routes>
            <Route path='/share/:token' element={<Fixture />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </MotionProvider>
  </ThemeProvider>,
)
