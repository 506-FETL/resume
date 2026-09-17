import { LightRays } from '@/components/ui/light-rays'
import { useIsMobile } from '@/hooks/use-mobile'
import { ForgotPasswordForm } from './components/forgot-password-form'

function ForgotPassword() {
  const isMobile = useIsMobile()

  return (
    <>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-4">
        <ForgotPasswordForm className="max-w-lg  mx-auto" />
      </div>
      {!isMobile && <LightRays />}
    </>
  )
}

export default ForgotPassword
