-- Free import has its own service-only admission ledger. It never touches the
-- paid AI quota/credit tables. No resume text or copied model fields are stored.
create table public.resume_import_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  version smallint not null check (version > 0),
  status text not null check (status in ('processing', 'succeeded', 'failed')),
  attempts smallint not null check (attempts between 1 and 2),
  lease_id uuid,
  lease_expires_at timestamptz,
  mapping jsonb check (mapping is null or jsonb_typeof(mapping) = 'object'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, content_hash, version),
  check (
    (status = 'processing' and lease_id is not null and lease_expires_at is not null and mapping is null)
    or (status = 'succeeded' and lease_id is null and lease_expires_at is null and mapping is not null)
    or (status = 'failed' and lease_id is null and lease_expires_at is null and mapping is null)
  )
);

create index resume_import_requests_expiry_idx
  on public.resume_import_requests (expires_at);

create table public.resume_import_daily_attempts (
  day date not null,
  scope text not null check (scope = 'global' or scope ~ '^user:[0-9a-f-]{36}$'),
  attempts integer not null default 0 check (attempts >= 0),
  primary key (day, scope)
);

alter table public.resume_import_requests enable row level security;
alter table public.resume_import_daily_attempts enable row level security;

revoke all on public.resume_import_requests from public, anon, authenticated;
revoke all on public.resume_import_daily_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.resume_import_requests to service_role;
grant select, insert, update, delete on public.resume_import_daily_attempts to service_role;

create policy resume_import_requests_service_only on public.resume_import_requests
  for all to service_role using (true) with check (true);
create policy resume_import_daily_attempts_service_only on public.resume_import_daily_attempts
  for all to service_role using (true) with check (true);

create function public.reserve_resume_import(
  p_user_id uuid,
  p_content_hash text,
  p_version smallint,
  p_user_daily_limit integer default 10,
  p_global_daily_limit integer default 1000
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_day date;
  v_user_scope text := 'user:' || p_user_id::text;
  v_request public.resume_import_requests%rowtype;
  v_lease_id uuid;
  v_global_attempts integer;
  v_user_attempts integer;
begin
  if p_user_id is null or p_content_hash is null
    or p_content_hash !~ '^[0-9a-f]{64}$'
    or p_version is null or p_version <= 0
    or p_user_daily_limit is null or p_user_daily_limit not between 0 and 1000000
    or p_global_daily_limit is null or p_global_daily_limit not between 0 and 1000000 then
    raise exception 'invalid import reservation';
  end if;

  -- This short transaction serializes admissions across accounts and hashes.
  -- It prevents both cache misses and daily counters racing past their limits.
  perform pg_catalog.pg_advisory_xact_lock(728344, 1);
  v_now := clock_timestamp();
  v_day := (v_now at time zone 'UTC')::date;

  -- Opportunistic bounded-retention cleanup also runs on cache-hit requests.
  delete from public.resume_import_requests
  where expires_at <= v_now
    and (status <> 'processing' or lease_expires_at <= v_now);
  delete from public.resume_import_daily_attempts where day < v_day - 2;

  select * into v_request from public.resume_import_requests
  where user_id = p_user_id and content_hash = p_content_hash and version = p_version
  for update;

  if found then
    if v_request.status = 'succeeded' then
      return jsonb_build_object('state', 'cached', 'mapping', v_request.mapping);
    end if;
    if v_request.status = 'processing' and v_request.lease_expires_at > v_now then
      return jsonb_build_object('state', 'processing');
    end if;
    if v_request.attempts >= 2 then
      return jsonb_build_object('state', 'unavailable');
    end if;
  end if;

  insert into public.resume_import_daily_attempts(day, scope, attempts)
  values (v_day, 'global', 0), (v_day, v_user_scope, 0)
  on conflict do nothing;

  select attempts into v_global_attempts from public.resume_import_daily_attempts
  where day = v_day and scope = 'global';
  select attempts into v_user_attempts from public.resume_import_daily_attempts
  where day = v_day and scope = v_user_scope;

  if v_global_attempts >= p_global_daily_limit or v_user_attempts >= p_user_daily_limit then
    return jsonb_build_object('state', 'rate_limited');
  end if;

  v_lease_id := gen_random_uuid();

  insert into public.resume_import_requests (
    user_id, content_hash, version, status, attempts, lease_id,
    lease_expires_at, expires_at, created_at, updated_at
  ) values (
    p_user_id, p_content_hash, p_version, 'processing', 1, v_lease_id,
    v_now + interval '60 seconds', v_now + interval '24 hours', v_now, v_now
  )
  on conflict (user_id, content_hash, version) do update set
    status = 'processing',
    attempts = resume_import_requests.attempts + 1,
    lease_id = v_lease_id,
    lease_expires_at = v_now + interval '60 seconds',
    mapping = null,
    updated_at = v_now;

  update public.resume_import_daily_attempts set attempts = attempts + 1
  where day = v_day and scope in ('global', v_user_scope);

  return jsonb_build_object('state', 'reserved', 'leaseId', v_lease_id);
end;
$$;

create function public.finish_resume_import(
  p_user_id uuid,
  p_content_hash text,
  p_version smallint,
  p_lease_id uuid,
  p_mapping jsonb default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_updated integer;
begin
  if p_mapping is not null and (
    jsonb_typeof(p_mapping) <> 'object' or octet_length(p_mapping::text) > 64000
  ) then
    raise exception 'invalid import mapping';
  end if;

  update public.resume_import_requests set
    status = case when p_mapping is null then 'failed' else 'succeeded' end,
    mapping = p_mapping,
    lease_id = null,
    lease_expires_at = null,
    expires_at = case when p_mapping is null then expires_at else v_now + interval '24 hours' end,
    updated_at = v_now
  where user_id = p_user_id and content_hash = p_content_hash and version = p_version
    and status = 'processing' and lease_id = p_lease_id and lease_expires_at > v_now;

  get diagnostics v_updated = row_count;

  return v_updated = 1;
end;
$$;

revoke all on function public.reserve_resume_import(uuid, text, smallint, integer, integer)
  from public, anon, authenticated;
revoke all on function public.finish_resume_import(uuid, text, smallint, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.reserve_resume_import(uuid, text, smallint, integer, integer)
  to service_role;
grant execute on function public.finish_resume_import(uuid, text, smallint, uuid, jsonb)
  to service_role;
