import { AuthLayout } from '@/components/layout/auth-layout'
import useAlreadyLoggedRedirect from '@/hooks/use-redirect'
import { SignUpForm } from './components/sign-up-form'
import { useSearchParams } from 'react-router-dom'
import { sanitizeAppRedirect } from '@/lib/auth/redirect'

function Signup() {
  const [searchParams] = useSearchParams()
  const redirect = sanitizeAppRedirect(searchParams.get('redirect'))

  useAlreadyLoggedRedirect(redirect)

  return (
    <AuthLayout>
      <SignUpForm redirect={redirect} />
    </AuthLayout>
  )
}

export default Signup
