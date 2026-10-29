import { isAuthError } from '@supabase/supabase-js'

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: '邮箱或密码不正确，请检查后重试。',
  email_not_confirmed: '请先通过验证邮件确认邮箱，再登录。',
  user_already_exists: '该邮箱已注册，可以直接登录或找回密码。',
  email_exists: '该邮箱已注册，可以直接登录或找回密码。',
  signup_disabled: '暂时无法创建账户，请稍后再试。',
  weak_password: '密码强度不足，请使用更长的密码。',
  email_address_invalid: '邮箱格式不正确，请检查后重试。',
  over_email_send_rate_limit: '邮件发送过于频繁，请稍后再试，并检查收件箱。',
  over_request_rate_limit: '操作过于频繁，请稍后再试。',
  request_timeout: '连接超时，请检查网络后重试。',
}

export function authErrorMessage(error: unknown, fallback: string): string {
  if (isAuthError(error)) {
    return AUTH_MESSAGES[error.code ?? ''] ?? fallback
  }
  if (error instanceof TypeError) return '网络连接失败，请检查网络后重试。'

  return fallback
}
