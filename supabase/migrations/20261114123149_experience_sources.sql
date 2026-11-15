create table public.experience_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  kind text not null check (kind in ('pdf', 'docx', 'text', 'markdown', 'paste')),
  status text not null default 'uploading' check (status in ('uploading', 'upload-failed', 'ready', 'deleting', 'delete-failed')),
  current_version_id uuid,
  preview_text text not null default '' check (length(preview_text) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create index experience_sources_owner_updated on public.experience_sources(owner_id, updated_at desc, id);

create table public.experience_source_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  owner_id uuid not null,
  source_name text not null,
  content_hash text not null,
  source_kind text not null check (source_kind in ('pdf', 'docx', 'text', 'markdown', 'paste')),
  object_key text,
  file_name text,
  file_mime text,
  file_size integer check (file_size between 1 and 10485760),
  extractor_version integer not null,
  extracted_text text not null check (length(extracted_text) between 1 and 60000),
  text_length integer not null,
  block_count integer not null check (block_count between 1 and 30000),
  created_at timestamptz not null default now(),
  foreign key (source_id, owner_id) references public.experience_sources(id, owner_id) on delete cascade,
  unique (source_id, id),
  unique (source_id, content_hash, source_kind),
  check ((object_key is null) = (file_name is null))
);

alter table public.experience_sources add constraint experience_sources_current_version_fkey
  foreign key (id, current_version_id) references public.experience_source_versions(source_id, id) deferrable initially deferred;

create index experience_versions_owner_hash on public.experience_source_versions(owner_id, content_hash);

create table public.experience_source_blocks (
  version_id uuid not null references public.experience_source_versions(id) on delete cascade,
  block_id text not null,
  ordinal integer not null,
  text text not null check (length(text) between 1 and 2400),
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset > start_offset),
  page integer check (page between 1 and 30),
  primary key (version_id, block_id),
  unique (version_id, ordinal)
);

create table public.experience_source_operations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  source_id uuid not null references public.experience_sources(id) on delete cascade,
  version_id uuid not null,
  request_hash text not null,
  object_key text,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  reused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, operation_id)
);

create index experience_operations_source on public.experience_source_operations(source_id);

create table public.experience_source_relations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null,
  version_id uuid not null,
  conversation_id uuid references public.ai_conversations(id) on delete cascade,
  resume_id uuid references public.resume_config(resume_id) on delete cascade,
  created_at timestamptz not null default now(),
  foreign key (source_id, owner_id) references public.experience_sources(id, owner_id) on delete cascade,
  foreign key (source_id, version_id) references public.experience_source_versions(source_id, id) on delete cascade,
  check (num_nonnulls(conversation_id, resume_id) = 1)
);

create unique index experience_relations_conversation on public.experience_source_relations(conversation_id, source_id) where conversation_id is not null;
create unique index experience_relations_resume on public.experience_source_relations(resume_id, source_id) where resume_id is not null;
create index experience_relations_owner_source on public.experience_source_relations(owner_id, source_id);

alter table public.experience_sources enable row level security;
alter table public.experience_source_versions enable row level security;
alter table public.experience_source_blocks enable row level security;
alter table public.experience_source_operations enable row level security;
alter table public.experience_source_relations enable row level security;

create policy experience_sources_owner_read on public.experience_sources for select to authenticated using (owner_id = (select auth.uid()));
create policy experience_versions_owner_read on public.experience_source_versions for select to authenticated using (owner_id = (select auth.uid()) and exists (select 1 from public.experience_sources s where s.id = source_id and s.status = 'ready'));
create policy experience_blocks_owner_read on public.experience_source_blocks for select to authenticated using (exists (select 1 from public.experience_source_versions v join public.experience_sources s on s.id = v.source_id where v.id = version_id and v.owner_id = (select auth.uid()) and s.status = 'ready'));
create policy experience_operations_owner_read on public.experience_source_operations for select to authenticated using (owner_id = (select auth.uid()));
create policy experience_relations_owner_read on public.experience_source_relations for select to authenticated using (owner_id = (select auth.uid()));

revoke all on public.experience_sources, public.experience_source_versions, public.experience_source_blocks, public.experience_source_operations, public.experience_source_relations from public, anon, authenticated;
grant select (id, owner_id, name, kind, status, current_version_id, preview_text, created_at, updated_at) on public.experience_sources to authenticated;
grant all on public.experience_sources, public.experience_source_versions, public.experience_source_blocks, public.experience_source_operations, public.experience_source_relations to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('experience-source-originals', 'experience-source-originals', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy experience_originals_no_client_objects on storage.objects as restrictive
for all to anon, authenticated using (bucket_id <> 'experience-source-originals') with check (bucket_id <> 'experience-source-originals');
create policy experience_originals_no_client_bucket_insert on storage.buckets as restrictive
for insert to anon, authenticated with check (id <> 'experience-source-originals');
create policy experience_originals_no_client_bucket_update on storage.buckets as restrictive
for update to anon, authenticated using (id <> 'experience-source-originals') with check (id <> 'experience-source-originals');
create policy experience_originals_no_client_bucket_delete on storage.buckets as restrictive
for delete to anon, authenticated using (id <> 'experience-source-originals');

-- 原件统一由鉴权 Edge 入口读取，不授予浏览器 storage.objects 的直接权限。
create or replace function public.reserve_experience_source(
  p_owner uuid, p_operation uuid, p_source uuid, p_name text, p_kind text,
  p_hash text, p_request_hash text, p_has_file boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  op public.experience_source_operations;
  source public.experience_sources;
  existing public.experience_source_versions;
  new_version uuid := gen_random_uuid();
  object_key text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 4141));
  select * into op from public.experience_source_operations where owner_id = p_owner and operation_id = p_operation;

  if found then
    if op.request_hash <> p_request_hash then raise exception 'operation_conflict'; end if;
    select * into source from public.experience_sources where id = op.source_id and owner_id = p_owner;
    if source.status in ('deleting', 'delete-failed') then raise exception 'source_unavailable'; end if;
    update public.experience_source_operations set status = case when status = 'failed' then 'pending' else status end, updated_at = now()
      where owner_id = p_owner and operation_id = p_operation;
    return jsonb_build_object('source', to_jsonb(source), 'versionId', op.version_id, 'objectKey', op.object_key, 'ready', op.status = 'ready', 'reused', op.reused);
  end if;

  if p_source is not null then
    select * into source from public.experience_sources where id = p_source and owner_id = p_owner for update;
    if not found then raise exception 'source_not_found'; end if;
    if source.status in ('deleting', 'delete-failed') then raise exception 'source_unavailable'; end if;
    select * into existing from public.experience_source_versions where source_id = p_source and content_hash = p_hash and source_kind = p_kind;
  else
    select v.* into existing from public.experience_source_versions v join public.experience_sources s on s.id = v.source_id
      where v.owner_id = p_owner and v.content_hash = p_hash and v.source_kind = p_kind and s.status = 'ready' and s.current_version_id = v.id order by v.created_at desc limit 1;
    if found then select * into source from public.experience_sources where id = existing.source_id; end if;
  end if;

  if existing.id is not null then
    if p_source is not null then
      update public.experience_sources set current_version_id = existing.id, name = p_name, kind = p_kind,
        preview_text = left(regexp_replace(existing.extracted_text, '\s+', ' ', 'g'), 160), status = 'ready', updated_at = now() where id = source.id returning * into source;
    end if;
    insert into public.experience_source_operations(owner_id, operation_id, source_id, version_id, request_hash, status, reused)
      values (p_owner, p_operation, source.id, existing.id, p_request_hash, 'ready', true);
    return jsonb_build_object('source', to_jsonb(source), 'versionId', existing.id, 'objectKey', null, 'ready', true, 'reused', true);
  end if;

  if source.id is null then
    insert into public.experience_sources(owner_id, name, kind) values(p_owner, p_name, p_kind) returning * into source;
  end if;
  object_key := case when p_has_file then p_owner::text || '/' || source.id::text || '/' || new_version::text else null end;
  insert into public.experience_source_operations(owner_id, operation_id, source_id, version_id, request_hash, object_key)
    values(p_owner, p_operation, source.id, new_version, p_request_hash, object_key);

  return jsonb_build_object('source', to_jsonb(source), 'versionId', new_version, 'objectKey', object_key, 'ready', false, 'reused', false);
end;
$$;

create or replace function public.finish_experience_source(p_owner uuid, p_operation uuid, p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  op public.experience_source_operations;
  source public.experience_sources;
  existing public.experience_source_versions;
  v_version_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 4141));
  select * into op from public.experience_source_operations where owner_id = p_owner and operation_id = p_operation for update;
  if not found then raise exception 'operation_not_found'; end if;
  select * into source from public.experience_sources where id = op.source_id and owner_id = p_owner for update;
  if source.status in ('deleting', 'delete-failed') then raise exception 'source_unavailable'; end if;
  if op.status = 'ready' then return jsonb_build_object('source', to_jsonb(source), 'versionId', op.version_id, 'reused', op.reused); end if;

  select * into existing from public.experience_source_versions where source_id = source.id and content_hash = p_input->>'contentHash' and source_kind = p_input->>'kind';
  v_version_id := coalesce(existing.id, op.version_id);

  if existing.id is null then
    insert into public.experience_source_versions(id, source_id, owner_id, source_name, content_hash, source_kind, object_key, file_name, file_mime, file_size, extractor_version, extracted_text, text_length, block_count)
      values(v_version_id, source.id, p_owner, p_input->>'sourceName', p_input->>'contentHash', p_input->>'kind', op.object_key, p_input->>'fileName', p_input->>'fileMime', (p_input->>'fileSize')::integer, (p_input->>'extractorVersion')::integer, p_input->>'text', (p_input->>'textLength')::integer, jsonb_array_length(p_input->'blocks'));
    insert into public.experience_source_blocks(version_id, block_id, ordinal, text, start_offset, end_offset, page)
      select v_version_id, b.value->>'id', b.ordinality::integer - 1, b.value->>'text', (b.value->>'start')::integer, (b.value->>'end')::integer, (b.value->>'page')::integer
      from jsonb_array_elements(p_input->'blocks') with ordinality b;
  end if;

  update public.experience_sources set name = p_input->>'name', kind = p_input->>'kind', status = 'ready', current_version_id = v_version_id,
    preview_text = left(regexp_replace(p_input->>'text', '\s+', ' ', 'g'), 160), updated_at = now()
    where id = source.id returning * into source;
  update public.experience_source_operations set status = 'ready', version_id = v_version_id, reused = existing.id is not null, updated_at = now()
    where owner_id = p_owner and operation_id = p_operation;

  return jsonb_build_object('source', to_jsonb(source), 'versionId', v_version_id, 'reused', existing.id is not null, 'unusedObjectKey', case when existing.id is not null then op.object_key else null end);
end;
$$;

create or replace function public.begin_delete_experience_source(p_owner uuid, p_source uuid)
returns text[] language plpgsql security invoker set search_path = '' as $$
declare source public.experience_sources; paths text[];
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 4141));
  select * into source from public.experience_sources where id = p_source and owner_id = p_owner for update;
  if not found then raise exception 'source_not_found'; end if;
  if exists(select 1 from public.experience_source_operations where source_id = p_source and status = 'pending' and updated_at > now() - interval '5 minutes') then raise exception 'upload_in_progress'; end if;
  update public.experience_sources set status = 'deleting', updated_at = now() where id = p_source;
  select array_agg(distinct object_key) into paths from (
    select object_key from public.experience_source_versions where source_id = p_source
    union all select object_key from public.experience_source_operations where source_id = p_source
  ) objects where object_key is not null;

  return coalesce(paths, '{}'::text[]);
end;
$$;

create or replace function public.set_experience_source_relations(p_owner uuid, p_target text, p_target_id uuid, p_references jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 4141));
  if p_target = 'conversation' then
    if not exists(select 1 from public.ai_conversations where id = p_target_id and user_id = p_owner) then raise exception 'target_not_found'; end if;
  elsif p_target = 'resume' then
    if not exists(select 1 from public.resume_config where resume_id = p_target_id and user_id = p_owner) then raise exception 'target_not_found'; end if;
  else raise exception 'invalid_target';
  end if;

  if exists(select 1 from jsonb_array_elements(p_references) r where not exists (
    select 1 from public.experience_sources s join public.experience_source_versions v on v.source_id = s.id
    where s.id = (r->>'sourceId')::uuid and v.id = (r->>'versionId')::uuid and s.owner_id = p_owner and s.status = 'ready'
  )) then raise exception 'source_not_found'; end if;

  delete from public.experience_source_relations where owner_id = p_owner and
    ((p_target = 'conversation' and conversation_id = p_target_id) or (p_target = 'resume' and resume_id = p_target_id));
  insert into public.experience_source_relations(owner_id, source_id, version_id, conversation_id, resume_id)
    select p_owner, (r->>'sourceId')::uuid, (r->>'versionId')::uuid,
      case when p_target = 'conversation' then p_target_id else null end,
      case when p_target = 'resume' then p_target_id else null end
    from jsonb_array_elements(p_references) r;
end;
$$;

create or replace function public.search_experience_sources(p_owner uuid, p_source_ids uuid[], p_query text, p_limit integer default 12, p_references jsonb default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with hits as (
    select s.id as source_id, s.name, v.id as version_id, b.block_id, b.ordinal, b.text, b.start_offset, b.end_offset, b.page,
      case when strpos(lower(b.text), lower(p_query)) > 0 then 2 else 1 end as relevance
    from public.experience_sources s
    join public.experience_source_versions v on v.source_id = s.id and (
      (p_references is null and v.id = s.current_version_id) or
      (p_references is not null and exists (select 1 from jsonb_array_elements(p_references) r where (r->>'sourceId')::uuid = s.id and (r->>'versionId')::uuid = v.id))
    )
    join public.experience_source_blocks b on b.version_id = v.id
    where s.owner_id = p_owner and s.status = 'ready' and s.id = any(p_source_ids)
      and (strpos(lower(b.text), lower(p_query)) > 0 or strpos(lower(s.name), lower(p_query)) > 0)
    order by relevance desc, s.updated_at desc, s.id, b.ordinal
    limit least(greatest(p_limit, 1), 20)
  ) select coalesce(jsonb_agg(jsonb_build_object(
    'sourceId', h.source_id, 'versionId', h.version_id, 'name', h.name,
    'block', jsonb_strip_nulls(jsonb_build_object('id', h.block_id, 'text', h.text, 'start', h.start_offset, 'end', h.end_offset, 'page', h.page)),
    'context', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', n.block_id, 'text', n.text, 'start', n.start_offset, 'end', n.end_offset, 'page', n.page)) order by n.ordinal), '[]'::jsonb)
      from public.experience_source_blocks n where n.version_id = h.version_id and n.ordinal between h.ordinal - 1 and h.ordinal + 1)
  ) order by h.relevance desc, h.source_id, h.ordinal), '[]'::jsonb) from hits h;
$$;

revoke all on function public.reserve_experience_source(uuid, uuid, uuid, text, text, text, text, boolean), public.finish_experience_source(uuid, uuid, jsonb), public.begin_delete_experience_source(uuid, uuid), public.set_experience_source_relations(uuid, text, uuid, jsonb), public.search_experience_sources(uuid, uuid[], text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.reserve_experience_source(uuid, uuid, uuid, text, text, text, text, boolean), public.finish_experience_source(uuid, uuid, jsonb), public.begin_delete_experience_source(uuid, uuid), public.set_experience_source_relations(uuid, text, uuid, jsonb), public.search_experience_sources(uuid, uuid[], text, integer, jsonb) to service_role;
