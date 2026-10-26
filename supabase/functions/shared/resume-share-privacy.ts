export interface SharePrivacyPolicy {
  purpose?: string | null
  show_phone?: boolean
  show_email?: boolean
}

/** Comments contain free text, anchors and original attachments; a private
 * contact projection must never grant access to that unfiltered document. */
export function canReadShareComments(policy: SharePrivacyPolicy) {
  return (
    policy.purpose !== 'showcase' &&
    policy.show_phone !== false &&
    policy.show_email !== false
  )
}

/** Apply to the complete response snapshot, including repeated text and legacy
 * keys, without changing the saved document or its owner comment projection. */
export function redactShareContacts<T>(
  snapshot: T,
  policy: SharePrivacyPolicy,
): T {
  if (policy.show_phone !== false && policy.show_email !== false)
    return snapshot

  const result = structuredClone(snapshot)
  const root = result as Record<string, unknown> | null

  const basics =
    root && typeof root === 'object'
      ? (root.basics as Record<string, unknown> | undefined)
      : undefined

  const secrets = [
    policy.show_phone === false ? basics?.phone : null,
    policy.show_email === false ? basics?.email : null,
  ].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )

  const visit = (value: unknown): unknown => {
    if (typeof value === 'string') {
      let text = value

      for (const secret of secrets) text = text.split(secret).join('')

      if (policy.show_email === false)
        text = text.replace(
          /(?:mailto:)?[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
          '',
        )
      if (policy.show_phone === false)
        text = text.replace(
          /(?:tel:)?(?:\+?86[ -]?)?1[3-9]\d(?:[ -]?\d){8}\b/g,
          '',
        )

      return text
    }
    if (Array.isArray(value)) return value.map(visit)
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          (policy.show_phone === false &&
            /^(phone|mobile|telephone|tel)$/i.test(key)) ||
          (policy.show_email === false && /^(email|mail)$/i.test(key))
            ? ''
            : visit(entry),
        ]),
      )
    }

    return value
  }

  return visit(result) as T
}
