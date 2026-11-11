import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shareContentRevision } from '../../../supabase/functions/resume-share/live-source.ts'
import {
  canReadShareComments,
  redactShareContacts,
} from '../../../supabase/functions/shared/resume-share-privacy.ts'

const phone = '13800138000'
const email = 'synthetic-contact@example.com'

function snapshot() {
  return {
    basics: { name: '合成姓名', phone, email },
    description: `电话 ${phone}；邮箱 ${email}；保留普通说明`,
    self_evaluation: {
      content: `<p>联系 ${phone} / ${email}</p><a href="mailto:${email}">邮箱</a><a href="tel:${phone}">电话</a>`,
    },
    nested: [{ text: `${phone} ${email}` }],
  }
}

for (const showPhone of [true, false]) {
  for (const showEmail of [true, false]) {
    test(`电话 ${showPhone} / 邮箱 ${showEmail} 分别投影`, () => {
      const source = snapshot()

      const result = redactShareContacts(source, {
        purpose: 'review',
        show_phone: showPhone,
        show_email: showEmail,
      })

      assert.equal(result.basics.phone, showPhone ? phone : 'XXXXXXX')
      assert.equal(result.basics.email, showEmail ? email : 'XXXXXXX')
      assert.equal(result.basics.name, source.basics.name)
      assert.equal(JSON.stringify(result).includes(phone), showPhone)
      assert.equal(JSON.stringify(result).includes(email), showEmail)

      assert.equal(
        canReadShareComments({
          purpose: 'review',
          show_phone: showPhone,
          show_email: showEmail,
        }),
        showPhone && showEmail,
      )
    })
  }
}

test('原空字段不产生新联系方式占位', () => {
  const source = {
    basics: { phone: '', email: ' \n\t' },
    empty: { mobile: null, mail: undefined, telephone: 0 },
    absent: { name: '未填写联系方式' },
  }

  const result = redactShareContacts(source, {
    show_phone: false,
    show_email: false,
  })

  assert.deepEqual(result.basics, { phone: '', email: '' })
  assert.deepEqual(result.empty, { mobile: '', mail: '', telephone: '' })
  assert.deepEqual(result.absent, source.absent)
  assert.ok(!JSON.stringify(result).includes('XXXXXXX'))
})

test('原有字段别名与大小写继续遵守对应开关', () => {
  const phoneFields = {
    phone,
    mobile: phone,
    telephone: phone,
    tel: phone,
    PHONE: phone,
  }

  const emailFields = { email, mail: email, EMAIL: email }

  const source = {
    basics: { phone, email },
    legacy: { ...phoneFields, ...emailFields },
  }

  const result = redactShareContacts(source, {
    show_phone: false,
    show_email: false,
  })

  for (const value of Object.values(result.legacy))
    assert.equal(value, 'XXXXXXX')

  const emailOnly = redactShareContacts(source, {
    show_phone: true,
    show_email: false,
  })

  for (const key of Object.keys(phoneFields))
    assert.equal(emailOnly.legacy[key], phone)

  for (const key of Object.keys(emailFields))
    assert.equal(emailOnly.legacy[key], 'XXXXXXX')
})

test('重复正文、标题与链接继续去掉原值，不制造掩码链接', () => {
  const source = { ...snapshot(), displayName: `合成简历 ${phone} ${email}` }

  const result = redactShareContacts(source, {
    show_phone: false,
    show_email: false,
  })

  const serialized = JSON.stringify(result)

  assert.ok(!serialized.includes(phone))
  assert.ok(!serialized.includes(email))
  assert.ok(result.description.includes('保留普通说明'))
  assert.ok(!result.self_evaluation.content.includes('XXXXXXX'))
  assert.ok(!result.displayName.includes('XXXXXXX'))
})

test('未出现在基本字段的联系方式仍受原模式清洗', () => {
  const source = {
    basics: { phone: '', email: '' },
    content: '其他号码 +86 139 0013 9000，其他邮箱 second@example.com',
  }

  const result = redactShareContacts(source, {
    show_phone: false,
    show_email: false,
  })

  assert.equal(result.basics.phone, '')
  assert.equal(result.basics.email, '')
  assert.ok(!result.content.includes('139'))
  assert.ok(!result.content.includes('second@example.com'))
})

test('投影不修改已保存或固定的输入快照', () => {
  const source = snapshot()
  const original = structuredClone(source)

  const result = redactShareContacts(source, {
    show_phone: false,
    show_email: false,
  })

  assert.deepEqual(source, original)
  assert.notEqual(result, source)
  assert.notEqual(result.basics, source.basics)
  assert.equal(source.basics.phone, phone)
  assert.equal(source.basics.email, email)
})

test('旧链接缺省公开，公开展示仍禁止评论和附件权限', () => {
  const source = snapshot()

  assert.equal(redactShareContacts(source, {}), source)
  assert.equal(canReadShareComments({}), true)

  assert.equal(
    canReadShareComments({
      purpose: 'application',
      show_phone: true,
      show_email: true,
    }),
    true,
  )

  assert.equal(
    canReadShareComments({
      purpose: 'showcase',
      show_phone: true,
      show_email: true,
    }),
    false,
  )

  assert.equal(
    canReadShareComments({
      purpose: 'review',
      show_phone: false,
      show_email: true,
    }),
    false,
  )

  assert.equal(
    canReadShareComments({
      purpose: 'review',
      show_phone: true,
      show_email: false,
    }),
    false,
  )
})

test('真实内容哈希区分旧空投影和新占位投影', () => {
  const result = redactShareContacts(snapshot(), {
    show_phone: false,
    show_email: false,
  })

  const oldProjection = structuredClone(result)

  oldProjection.basics.phone = ''
  oldProjection.basics.email = ''

  assert.notEqual(
    shareContentRevision({ snapshot: result }),
    shareContentRevision({ snapshot: oldProjection }),
  )

  assert.equal(
    shareContentRevision({ snapshot: result }),
    shareContentRevision({ snapshot: structuredClone(result) }),
  )
})
