import { corsPreflightResponse, isOriginAllowed } from '../shared/cors.ts'
import { createRequestContext } from '../shared/request-context.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import {
  authenticateSupabaseUser,
  SupabaseAuthenticationError,
} from '../shared/supabase-auth.ts'
import { boundedForm } from './form.ts'
import { parseExperienceInput, ExperienceRequestError } from './input.ts'
import { handleExperienceInput } from './operations.ts'

export async function handleExperienceRequest(request: Request) {
  if (request.method === 'OPTIONS')
    return corsPreflightResponse(request, 'allowlist')

  const headers = createRequestContext(
    request,
    'experience-sources',
    'allowlist',
  ).responseHeaders()

  headers.set('Cache-Control', 'no-store')

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...Object.fromEntries(headers),
        'Content-Type': 'application/json',
      },
    })

  if (request.method !== 'POST' || !isOriginAllowed(request, 'allowlist'))
    return respond({ code: 'invalid_request', error: '请求无效。' }, 400)

  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''

    const admin = createClient(
      url,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { userId } = await authenticateSupabaseUser({
      request,
      client: admin,
      supabaseUrl: url,
    })

    if (!userId)
      return respond({ code: 'unauthorized', error: '请先登录。' }, 401)

    const form = await boundedForm(request)
    let raw: unknown

    try {
      raw = JSON.parse(String(form.get('input') ?? '{}'))
    } catch {
      return respond({ code: 'invalid_request', error: '请求内容无效。' }, 400)
    }

    const input = parseExperienceInput(raw)
    const file = form.get('file')

    const result = await handleExperienceInput(
      admin,
      userId,
      input,
      file instanceof File ? file : null,
    )

    if (result instanceof Response) {
      for (const [key, value] of headers) result.headers.set(key, value)

      return result
    }

    return respond(result)
  } catch (error) {
    if (error instanceof SupabaseAuthenticationError)
      return respond(
        { code: 'unauthorized', error: '登录已失效，请重新登录。' },
        401,
      )
    if (error instanceof ExperienceRequestError)
      return respond({ code: error.code, error: error.message }, error.status)

    const code = (error as { message?: string })?.message

    const known: Record<string, [number, string]> = {
      operation_conflict: [409, '本次操作内容已改变，请重新发起保存。'],
      source_not_found: [404, '资料不存在或已删除。'],
      source_unavailable: [409, '资料正在删除，暂时无法读取或更新。'],
      source_scope_mismatch: [409, '这份文件不能改存到其他位置，请重新上传。'],
      target_not_found: [404, '会话或简历不存在。'],
      upload_in_progress: [409, '资料仍在保存，请稍后重试删除。'],
    }

    if (code && known[code])
      return respond({ code, error: known[code][1] }, known[code][0])

    return respond(
      { code: 'unavailable', error: '请求结果暂未确认，请稍后重试。' },
      503,
    )
  }
}
