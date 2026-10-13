import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { Repo } from '@automerge/automerge-repo'
import ts from 'typescript'

// Isolated PostgreSQL runtime; no cloud credentials or production writes.
// Install PGlite in an ignored scratch directory and pass its module file URL.
const runtime = process.env.PGLITE_MODULE
if (!runtime) {
  throw new Error(
    'Set PGLITE_MODULE to the installed @electric-sql/pglite/dist/index.js path',
  )
}
const { PGlite } = await import(pathToFileURL(runtime).href)
const db = new PGlite()
const migration = readFileSync(
  new URL(
    '../supabase/migrations/20261013092216_secure_automerge_collaboration_transport.sql',
    import.meta.url,
  ),
  'utf8',
)
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated;
  CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA realtime;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
  CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.topic', true) $$;
  CREATE TABLE auth.users(id uuid PRIMARY KEY);
  CREATE TABLE public.resume_comment_collaboration_sessions(
    session_id text PRIMARY KEY, resume_id uuid, owner_user_id uuid, host_lease_id uuid,
    protocol_version smallint, revoked_at timestamptz, expires_at timestamptz);
  CREATE TABLE public.resume_comment_collaboration_members(
    session_id text, user_id uuid, member_lease_id uuid, protocol_version smallint,
    revoked_at timestamptz, expires_at timestamptz, PRIMARY KEY(session_id,user_id));
  CREATE TABLE public.resume_comment_collaboration_member_leases(
    session_id text, user_id uuid, member_lease_id uuid, revoked_at timestamptz, expires_at timestamptz);
  CREATE TABLE realtime.messages(id serial, topic text, extension text, event text, payload jsonb, private boolean);
  ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
  GRANT USAGE ON SCHEMA auth,realtime TO anon,authenticated;
  GRANT SELECT, INSERT ON realtime.messages TO anon,authenticated;
  GRANT USAGE ON SEQUENCE realtime.messages_id_seq TO anon,authenticated;
  CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) RETURNS void LANGUAGE sql AS $$
    INSERT INTO realtime.messages(topic,extension,event,payload,private) VALUES(topic,'broadcast',event,payload,private)
  $$;
`)
await db.exec(migration)
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const owner = uid(1)
const guest = uid(2)
const outsider = uid(3)
const legacy = uid(4)
const resume = uid(10)
const hostLease = uid(11)
const memberLease = uid(12)
const session = 'fixture-session-v2'
await db.exec(`INSERT INTO auth.users VALUES ('${owner}'),('${guest}'),('${outsider}'),('${legacy}');
  INSERT INTO public.resume_comment_collaboration_sessions VALUES
    ('${session}','${resume}','${owner}','${hostLease}',2,NULL,now()+interval '1 hour'),
    ('fixture-session-v1','${resume}','${owner}','${hostLease}',1,NULL,now()+interval '1 hour');
  INSERT INTO public.resume_comment_collaboration_members VALUES
    ('${session}','${guest}','${memberLease}',2,NULL,now()+interval '1 hour'),
    ('fixture-session-v1','${legacy}','${uid(13)}',1,NULL,now()+interval '1 hour');
  INSERT INTO public.resume_comment_collaboration_member_leases VALUES
    ('${session}','${guest}','${memberLease}',NULL,now()+interval '1 hour');`)
let queue = Promise.resolve()
function serial(fn) {
  const result = queue.then(fn)
  queue = result.catch(() => {})
  return result
}
async function asUser(user, fn, role = user ? 'authenticated' : 'anon') {
  await db.exec(`SET ROLE ${role}`)
  await db.query('SELECT set_config(\'test.uid\',$1,false)', [user || ''])
  try {
    return await fn()
  }
  finally {
    await db.exec('RESET ROLE')
  }
}
const rpcArgs = {
  open_automerge_peer: [
    'p_session_id',
    'p_resume_id',
    'p_peer_id',
    'p_protocol_version',
    'p_lease_id',
    'p_metadata',
  ],
  refresh_automerge_peer: ['p_inbox_id'],
  close_automerge_peer: ['p_inbox_id'],
  send_automerge_message: ['p_inbox_id', 'p_event', 'p_payload'],
}
async function rpcRaw(user, name, args) {
  return asUser(user, async () => {
    const keys = rpcArgs[name]
    const { rows } = await db.query(
      `SELECT public.${name}(${keys.map((_, i) => `$${i + 1}`).join(',')}) AS value`,
      keys.map(k => args[k]),
    )
    return rows[0].value
  })
}
const channels = []
let delivered = 0
async function dispatch() {
  const { rows } = await db.query(
    'SELECT * FROM realtime.messages WHERE id > $1 ORDER BY id',
    [delivered],
  )
  for (const row of rows) {
    delivered = row.id
    // Intentionally cache authorization for the entire subscription, like Realtime.
    for (const channel of channels) {
      if (channel.subscribed && channel.topic === row.topic) {
        queueMicrotask(() =>
          channel.handlers[row.event]?.({ payload: row.payload }),
        )
      }
    }
  }
}
function rpc(user, name, args) {
  return serial(async () => {
    const result = await rpcRaw(user, name, args)
    await dispatch()
    return result
  })
}
function open(user, peerId, leaseId, protocolVersion = 2, sessionId = session) {
  return rpc(user, 'open_automerge_peer', {
    p_session_id: sessionId,
    p_resume_id: resume,
    p_peer_id: peerId,
    p_protocol_version: protocolVersion,
    p_lease_id: leaseId,
    p_metadata: { userId: owner, role: 'host' },
  })
}
function packet(targetId, extra = {}) {
  return {
    targetId,
    documentId: 'test-doc',
    message: 'AA==',
    messageType: 'sync',
    ...extra,
  }
}
function send(user, inbox, target, extra = {}) {
  return rpc(user, 'send_automerge_message', {
    p_inbox_id: inbox,
    p_event: 'automerge-sync',
    p_payload: packet(target, extra),
  })
}
async function denied(fn) {
  await assert.rejects(fn, e => ['42501', '22023'].includes(e.code))
}

const host = await open(owner, 'host', hostLease)
const member = await open(guest, 'member', memberLease)
await rpc(owner, 'refresh_automerge_peer', { p_inbox_id: host.inboxId })
await rpc(guest, 'refresh_automerge_peer', { p_inbox_id: member.inboxId })
await denied(() => open(null, 'anon', null))
await denied(() => open(outsider, 'outsider', memberLease))
await denied(() => open(guest, 'host', memberLease))
await denied(() => open(guest, 'wrong-lease', uid(99)))
const v1 = await open(legacy, 'legacy', null, 1, 'fixture-session-v1')
assert.ok(v1.inboxId)
await send(guest, member.inboxId, 'host', { senderId: 'host', userId: owner })
const messages = (await db.query('SELECT * FROM realtime.messages')).rows
assert.equal(messages.at(-1).payload.senderId, 'member')
assert.equal(messages.at(-1).payload.userId, guest)
assert.equal(messages.at(-1).payload.metadata.role, 'guest')
await denied(() =>
  rpc(guest, 'send_automerge_message', {
    p_inbox_id: host.inboxId,
    p_event: 'automerge-sync',
    p_payload: packet('member'),
  }),
)
await denied(() =>
  rpc(guest, 'send_automerge_message', {
    p_inbox_id: member.inboxId,
    p_event: 'automerge-control',
    p_payload: { type: 'share-ended' },
  }),
)

// A broad permissive policy cannot bypass the document-specific guards.
await db.exec(
  `CREATE POLICY broad_fixture ON realtime.messages FOR ALL TO anon,authenticated USING(true) WITH CHECK(true)`,
)
await asUser(guest, async () => {
  await db.query('SELECT set_config(\'test.topic\',$1,false)', [member.topic])
  await denied(() =>
    db.query(
      'INSERT INTO realtime.messages(topic,extension) VALUES($1,\'broadcast\')',
      [member.topic],
    ),
  )
  await db.query('SELECT set_config(\'test.topic\',$1,false)', [host.topic])
  assert.equal(
    (await db.query('SELECT * FROM realtime.messages')).rows.length,
    0,
  )
})
await asUser(null, async () => {
  await db.query('SELECT set_config(\'test.topic\',$1,false)', [host.topic])
  assert.equal(
    (await db.query('SELECT * FROM realtime.messages')).rows.length,
    0,
  )
})
await asUser(guest, async () => {
  await db.query(
    'SELECT set_config(\'test.topic\',\'resume-comments:hmac-fixture\',false)',
  )
  await db.exec(
    'INSERT INTO realtime.messages(topic,extension) VALUES(\'resume-comments:hmac-fixture\',\'broadcast\')',
  )
})
await db.exec('DROP POLICY broad_fixture ON realtime.messages')
await db.exec(
  `UPDATE public.resume_comment_collaboration_members SET revoked_at=now() WHERE user_id='${guest}'`,
)
const count = (
  await db.query('SELECT count(*)::int AS n FROM realtime.messages')
).rows[0].n
await send(owner, host.inboxId, 'member')
assert.equal(
  (await db.query('SELECT count(*)::int AS n FROM realtime.messages')).rows[0]
    .n,
  count,
)
await denied(() => send(guest, member.inboxId, 'host'))
await denied(() => open(guest, 'revoked', memberLease))
await db.exec(
  `UPDATE public.resume_comment_collaboration_members SET revoked_at=NULL,expires_at=now()-interval '1 second' WHERE user_id='${guest}'`,
)
await denied(() => send(guest, member.inboxId, 'host'))
await send(owner, host.inboxId, 'member')
assert.equal(
  (await db.query('SELECT count(*)::int AS n FROM realtime.messages')).rows[0]
    .n,
  count,
)
await db.exec(`UPDATE public.resume_comment_collaboration_members SET expires_at=now()+interval '1 hour' WHERE user_id='${guest}';
  UPDATE public.resume_comment_collaboration_member_leases SET revoked_at=now() WHERE user_id='${guest}'`)
await denied(() => open(guest, 'tombstone', memberLease))
await db.exec(
  `UPDATE public.resume_comment_collaboration_member_leases SET revoked_at=NULL WHERE user_id='${guest}'`,
)
const expiredPeer = await open(guest, 'expired-live-peer', memberLease)
await rpc(guest, 'refresh_automerge_peer', { p_inbox_id: expiredPeer.inboxId })
await db.exec(`UPDATE public.resume_comment_collaboration_members SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id='${guest}'`)
await denied(() => send(guest, expiredPeer.inboxId, 'host'))
await send(owner, host.inboxId, 'expired-live-peer')
assert.equal((await db.query('SELECT count(*)::int AS n FROM realtime.messages')).rows[0].n, count)
await db.exec(`UPDATE public.resume_comment_collaboration_members SET expires_at=clock_timestamp()+interval '1 hour' WHERE user_id='${guest}'`)
await denied(() => send(guest, expiredPeer.inboxId, 'host'))
const secondTab = await open(owner, 'second-tab', hostLease)
await rpc(owner, 'refresh_automerge_peer', { p_inbox_id: secondTab.inboxId })
await rpc(owner, 'close_automerge_peer', { p_inbox_id: secondTab.inboxId })
await rpc(owner, 'refresh_automerge_peer', { p_inbox_id: host.inboxId })
await denied(() => send(owner, host.inboxId, 'member', { message: 'A'.repeat(240001) }))
await db.exec(`UPDATE public.resume_comment_collaboration_members SET revoked_at=now() WHERE user_id='${legacy}';
  UPDATE public.resume_comment_collaboration_members SET revoked_at=NULL WHERE user_id='${legacy}'`)
await denied(() => rpc(legacy, 'refresh_automerge_peer', { p_inbox_id: v1.inboxId }))
await open(legacy, 'legacy-rejoin', null, 1, 'fixture-session-v1')
await db.exec(`UPDATE public.resume_comment_collaboration_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE session_id='fixture-session-v1'`)
await denied(() => open(owner, 'expired-session-owner', hostLease, 1, 'fixture-session-v1'))
await db.exec(`UPDATE public.resume_comment_collaboration_sessions SET expires_at=clock_timestamp()+interval '1 hour',revoked_at=clock_timestamp() WHERE session_id='fixture-session-v1'`)
await denied(() => open(owner, 'revoked-session-owner', hostLease, 1, 'fixture-session-v1'))
process.stdout.write(
  'SQL authorization: owner/v1/v2 allowed; anon/nonmember/wrong lease/revoked/expired/tombstone rejected; sender bound; RLS guards, comment compatibility, permanent inbox retirement, multi-tab cleanup, payload limit passed\n',
)

// Execute the real adapter and Automerge Repo against real SQL RPCs. Only the
// websocket transport is simulated; it deliberately retains stale subscriptions.
function client(user) {
  return {
    rpc: async (name, args) => {
      try {
        return { data: await rpc(user, name, args), error: null }
      }
      catch (error) {
        return { data: null, error }
      }
    },
    channel(topic, options) {
      assert.equal(options.config.private, true)
      const channel = {
        topic,
        handlers: {},
        subscribed: false,
        on(_kind, { event }, callback) {
          this.handlers[event] = callback
          return this
        },
        subscribe(callback) {
          serial(async () => {
            const allowed = await asUser(
              user,
              async () =>
                (
                  await db.query(
                    'SELECT private.can_receive_automerge($1) AS ok',
                    [topic],
                  )
                ).rows[0].ok,
            )
            this.subscribed = allowed
            callback(allowed ? 'SUBSCRIBED' : 'CHANNEL_ERROR')
          }).catch(() => callback('CHANNEL_ERROR'))
          this.status = callback
          return this
        },
        async unsubscribe() {
          this.subscribed = false
          return 'ok'
        },
      }
      channels.push(channel)
      return channel
    },
  }
}
globalThis.__collabClients = new Map()
function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}
function compile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText
}
const constants = moduleUrl(
  compile(
    readFileSync(
      new URL('../src/lib/automerge/shared/constants.ts', import.meta.url),
      'utf8',
    ),
  ),
)
const utils = moduleUrl(
  compile(
    readFileSync(
      new URL('../src/lib/automerge/shared/utils.ts', import.meta.url),
      'utf8',
    ),
  ).replace('\'./constants\'', JSON.stringify(constants)),
)
const shared = moduleUrl(
  `export * from ${JSON.stringify(constants)}; export * from ${JSON.stringify(utils)};`,
)
async function adapterFor(user, auth) {
  globalThis.__collabClients.set(user, client(user))
  let code = compile(
    readFileSync(
      new URL(
        '../src/lib/automerge/collaboration/supabase-network-adapter.ts',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  code = code
    .replace(
      'import supabase from \'@/lib/supabase/client\';',
      `const supabase=globalThis.__collabClients.get(${JSON.stringify(user)});`,
    )
    .replace(
      '\'@automerge/automerge-repo\'',
      JSON.stringify(import.meta.resolve('@automerge/automerge-repo')),
    )
    .replace('\'../shared\'', JSON.stringify(shared))
  const { SupabaseNetworkAdapter } = await import(moduleUrl(code))
  return new SupabaseNetworkAdapter(resume, session, { authorization: auth })
}
async function until(fn) {
  for (let i = 0; i < 300; i++) {
    if (fn())
      return
    await new Promise(r => setTimeout(r, 10))
  }
  assert.fail('Timed out waiting for Automerge sync')
}
const adapters = []
const repos = []
try {
  let a = await adapterFor(owner, { protocolVersion: 2, leaseId: hostLease })
  const b = await adapterFor(guest, {
    protocolVersion: 2,
    leaseId: memberLease,
  })
  adapters.push(a, b)
  const r1 = new Repo({ network: [], sharePolicy: async () => true })
  const r2 = new Repo({ network: [], sharePolicy: async () => true })
  repos.push(r1, r2)
  let h1 = r1.create({ secret: 'owner document' })
  const A = await import('@automerge/automerge')
  const h2 = r2.import(A.save(h1.doc()), { docId: h1.documentId })
  assert.equal(h1.documentId, h2.documentId)
  a.setLocalDocumentId(h1.documentId)
  b.setLocalDocumentId(h2.documentId)
  r1.networkSubsystem.addNetworkAdapter(a)
  await a.whenReady()
  assert.equal(a.isReady(), true)
  r2.networkSubsystem.addNetworkAdapter(b)
  await b.whenReady()
  assert.equal(b.isReady(), true)
  h1.change((d) => {
    d.secret = 'authorized sync'
  })
  await until(() => h2.doc().secret === 'authorized sync')
  h2.change((d) => {
    d.secret = 'guest edit'
  })
  await until(() => h1.doc().secret === 'guest edit')
  // Owner restoration imports persisted bytes without docId, whereas an invited
  // guest keeps the original docUrl. The session still identifies one resume.
  const persistedBytes = A.save(h1.doc())
  a.disconnect()
  const restoredRepo = new Repo({ network: [], sharePolicy: async () => true })
  repos.push(restoredRepo)
  h1 = restoredRepo.import(persistedBytes)
  assert.notEqual(h1.documentId, h2.documentId)
  a = await adapterFor(owner, { protocolVersion: 2, leaseId: hostLease })
  adapters.push(a)
  a.setLocalDocumentId(h1.documentId)
  restoredRepo.networkSubsystem.addNetworkAdapter(a)
  await a.whenReady()
  assert.equal(a.isReady(), true)
  h1.change((d) => {
    d.secret = 'restored owner edit'
  })
  await until(() => h2.doc().secret === 'restored owner edit')
  h2.change((d) => {
    d.secret = 'guest edit after owner restore'
  })
  await until(() => h1.doc().secret === 'guest edit after owner restore')
  // Keep guest's websocket subscribed after revocation to model cached RLS.
  await serial(() =>
    db.exec(
      `UPDATE public.resume_comment_collaboration_members SET revoked_at=now() WHERE user_id='${guest}'`,
    ),
  )
  const guestChannel = channels.find(c => c.topic === b.getChannelName())
  assert.equal(guestChannel.subscribed, true)
  h1.change((d) => {
    d.secret = 'secret after revoke'
  })
  await new Promise(r => setTimeout(r, 150))
  await queue
  assert.equal(h2.doc().secret, 'guest edit after owner restore')
  assert.equal(guestChannel.subscribed, true)
  h2.change((d) => {
    d.secret = 'malicious revoked edit'
  })
  await until(() => !b.isReady())
  assert.equal(h1.doc().secret, 'secret after revoke')
  // Failed subscription must settle readiness and never fall back to public.
  const deniedAdapter = await adapterFor(outsider, {
    protocolVersion: 2,
    leaseId: memberLease,
  })
  adapters.push(deniedAdapter)
  deniedAdapter.connect('denied-peer')
  await deniedAdapter.whenReady()
  assert.equal(deniedAdapter.isReady(), false)
  const ownerChannel = channels.find(c => c.topic === a.getChannelName())
  ownerChannel.status('CHANNEL_ERROR')
  assert.equal(a.isReady(), false)
  process.stdout.write(
    'Actual adapter + Automerge: bidirectional sync and restored owner with a new document ID passed; cached revoked subscriber receives no new data; revoked edit rejected; auth/channel failures close and settle readiness\n',
  )
}
finally {
  for (const adapter of adapters) adapter.disconnect()
  for (const repo of repos) repo.networkSubsystem.disconnect()
  await queue
  await db.close()
}
