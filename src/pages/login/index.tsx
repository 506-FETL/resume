import { useSearchParams } from 'react-router-dom'
import { LightRays } from '@/components/ui/light-rays'
import { useIsMobile } from '@/hooks/use-mobile'
import useAlreadyLoggedRedirect from '@/hooks/use-redirect'
import { sanitizeAppRedirect } from '@/lib/auth/redirect'
import { LoginForm } from './components/login-form'

function Login() {
  const [searchParams] = useSearchParams()
  const redirect = sanitizeAppRedirect(searchParams.get('redirect'))
  useAlreadyLoggedRedirect(redirect)
  const isMobile = useIsMobile()

  return (
    <>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-4">
        <LoginForm redirect={redirect} className="max-w-lg mx-auto" />
      </div>
      {!isMobile && <LightRays />}
    </>
  )
}

export default Login
