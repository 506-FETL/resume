import { LightRays } from '@/components/ui/light-rays'
import { useIsMobile } from '@/hooks/use-mobile'
import { ResetPasswordForm } from './components/reset-password-form'

export default function ResetPassword() {
  const isMobile = useIsMobile()
  return (
    <>
      <div className="absolute top-1/2 left-1/2 w-full -translate-x-1/2 -translate-y-1/2 px-4">
        <ResetPasswordForm />
      </div>
      {!isMobile && <LightRays />}
    </>
  )
}
