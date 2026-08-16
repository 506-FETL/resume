/* global Deno */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import { corsPreflightResponse, isOriginAllowed } from '../shared/cors.ts'
import { hasValidMaintenanceToken } from '../shared/maintenance-auth.ts'
import {
  recordOperationMetric,
  scheduleBackground,
} from '../shared/operation-metrics.ts'
import { createRequestContext } from '../shared/request-context.ts'
import {
  buildBackendAlertWebhook,
  readBackendOpsSnapshot,
  readHttpsWebhookUrl,
} from './core.ts'

function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type AdminClient = ReturnType<typeof createAdminClient>

Deno.serve(async (request) => {
  const context = createRequestContext(
    request,
    'backend-ops-monitor',
    'allowlist',
  )
  let admin: AdminClient | null = null

  const respond = (
    body: unknown,
    status: number,
    outcome: 'success' | 'client_error' | 'server_error',
    errorCode?: string,
  ) => {
    context.log({
      level:
        outcome === 'success'
          ? 'info'
          : outcome === 'client_error'
            ? 'warn'
            : 'error',
      event: outcome === 'success' ? 'request_completed' : 'request_failed',
      operation: 'monitor',
      status,
      errorCode,
    })
    if (admin) {
      scheduleBackground(
        recordOperationMetric(admin, {
          requestId: context.requestId,
          functionName: 'backend-ops-monitor',
          operation: 'monitor',
          outcome,
          errorCode,
          status,
          durationMs: context.durationMs(),
        }),
      )
    }
    return context.json(body, status)
  }

  if (request.method === 'OPTIONS')
    return corsPreflightResponse(request, 'allowlist')
  if (!isOriginAllowed(request, 'allowlist')) {
    return respond(
      { error: 'origin_forbidden' },
      403,
      'client_error',
      'origin_forbidden',
    )
  }
  if (request.method !== 'POST')
    return respond({ error: 'not_found' }, 404, 'client_error', 'not_found')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const maintenanceToken = Deno.env.get('BACKEND_MAINTENANCE_TOKEN')
  if (
    !supabaseUrl
    || !serviceRoleKey
    || !maintenanceToken
    || maintenanceToken.length < 32
  ) {
    return respond(
      { error: 'service_not_configured' },
      500,
      'server_error',
      'service_not_configured',
    )
  }
  if (!hasValidMaintenanceToken(request, maintenanceToken)) {
    return respond(
      { error: 'unauthorized' },
      401,
      'client_error',
      'unauthorized',
    )
  }

  const rawBody = await request.text()
  let body: unknown = {}
  try {
    body = rawBody.trim() ? JSON.parse(rawBody) : {}
  }
  catch {
    return respond(
      { error: 'unsupported_payload' },
      400,
      'client_error',
      'unsupported_payload',
    )
  }
  if (
    !body
    || typeof body !== 'object'
    || Array.isArray(body)
    || Object.keys(body).length > 0
  ) {
    return respond(
      { error: 'unsupported_payload' },
      400,
      'client_error',
      'unsupported_payload',
    )
  }

  admin = createAdminClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await admin.rpc('evaluate_backend_ops_alerts_v1', {
    p_window_minutes: 15,
  })
  if (error) {
    return respond(
      { error: 'ops_snapshot_failed' },
      503,
      'server_error',
      'ops_snapshot_failed',
    )
  }
  const snapshot = readBackendOpsSnapshot(data)
  if (!snapshot) {
    return respond(
      { error: 'ops_snapshot_invalid' },
      503,
      'server_error',
      'ops_snapshot_invalid',
    )
  }
  const webhookUrl = readHttpsWebhookUrl(Deno.env.get('OPS_ALERT_WEBHOOK_URL'))

  if (snapshot.notificationCodes.length === 0) {
    return respond(
      {
        ok: true,
        alertCount: snapshot.alerts.length,
        notificationDue: false,
        deliveryConfigured: Boolean(webhookUrl),
      },
      200,
      'success',
    )
  }

  if (!webhookUrl) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        event: 'alert_delivery_not_configured',
        function: 'backend-ops-monitor',
        requestId: context.requestId,
        alertCount: snapshot.notificationCodes.length,
      }),
    )
    return respond(
      {
        ok: true,
        alertCount: snapshot.alerts.length,
        notificationDue: true,
        deliveryConfigured: false,
      },
      200,
      'success',
    )
  }

  let webhookResponse: Response
  try {
    webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': '506-resume-backend-monitor',
      },
      body: JSON.stringify(buildBackendAlertWebhook(snapshot)),
      signal: AbortSignal.timeout(5_000),
    })
  }
  catch {
    return respond(
      { error: 'alert_delivery_failed' },
      503,
      'server_error',
      'alert_delivery_failed',
    )
  }
  if (!webhookResponse.ok) {
    return respond(
      { error: 'alert_delivery_failed' },
      503,
      'server_error',
      'alert_delivery_failed',
    )
  }

  const { error: ackError } = await admin.rpc('ack_backend_alert_delivery_v1', {
    p_alert_codes: snapshot.notificationCodes,
  })
  if (ackError) {
    return respond(
      { error: 'alert_ack_failed' },
      503,
      'server_error',
      'alert_ack_failed',
    )
  }

  return respond(
    {
      ok: true,
      alertCount: snapshot.alerts.length,
      notificationDue: true,
      deliveryConfigured: true,
      delivered: true,
    },
    200,
    'success',
  )
})
