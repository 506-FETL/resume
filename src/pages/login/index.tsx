import { useSearchParams } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/auth-layout'
import useAlreadyLoggedRedirect from '@/hooks/use-redirect'
import { sanitizeAppRedirect } from '@/lib/auth/redirect'
import { LoginForm } from './components/login-form'

function Login() {
  const [searchParams] = useSearchParams()
  const redirect = sanitizeAppRedirect(searchParams.get('redirect'))
  useAlreadyLoggedRedirect(redirect)

  return (
    <AuthLayout><LoginForm redirect={redirect} /></AuthLayout>
  )
}

export default Login
