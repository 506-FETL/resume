import { AuthLayout } from '@/components/layout/auth-layout'
import useAlreadyLoggedRedirect from '@/hooks/use-redirect'
import { SignUpForm } from './components/sign-up-form'

function Signup() {
  useAlreadyLoggedRedirect()

  return (
    <AuthLayout><SignUpForm /></AuthLayout>
  )
}

export default Signup
