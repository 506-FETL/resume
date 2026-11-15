alter table public.ai_conversations
  add constraint ai_conversations_id_user_id_key unique (id, user_id);

alter table public.experience_sources
  add column conversation_id uuid,
  add constraint experience_sources_conversation_owner_fkey
    foreign key (conversation_id, owner_id)
    references public.ai_conversations(id, user_id)
    on delete no action deferrable initially deferred;

-- 延后检查使 auth.users 的两条级联路径能一起收尾；单独删会话仍须先清理附件。
create index experience_sources_owner_conversation_updated
  on public.experience_sources(owner_id, conversation_id, updated_at desc, id)
  where conversation_id is not null;

grant select (conversation_id) on public.experience_sources to authenticated;

-- 保留单一签名，默认参数兼容已有八参数调用，避免 PostgREST 重载歧义。
drop function public.reserve_experience_source(uuid, uuid, uuid, text, text, text, text, boolean);

create function public.reserve_experience_source(
  p_owner uuid, p_operation uuid, p_source uuid, p_name text, p_kind text,
  p_hash text, p_request_hash text, p_has_file boolean,
  p_conversation uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  op public.experience_source_operations;
  source public.experience_sources;
  existing public.experience_source_versions;
  new_version uuid := gen_random_uuid();
  object_key text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 4141));

  if p_conversation is not null and not exists (
    select 1 from public.ai_conversations where id = p_conversation and user_id = p_owner
  ) then
    raise exception 'target_not_found';
  end if;

  select * into op from public.experience_source_operations where owner_id = p_owner and operation_id = p_operation;

  if found then
    if op.request_hash <> p_request_hash or (p_source is not null and p_source <> op.source_id) then
      raise exception 'operation_conflict';
    end if;

    select * into source from public.experience_sources where id = op.source_id and owner_id = p_owner;

    if source.conversation_id is distinct from p_conversation then raise exception 'source_scope_mismatch'; end if;
    if source.status in ('deleting', 'delete-failed') then raise exception 'source_unavailable'; end if;

    update public.experience_source_operations set status = case when status = 'failed' then 'pending' else status end, updated_at = now()
      where owner_id = p_owner and operation_id = p_operation;

    return jsonb_build_object('source', to_jsonb(source), 'versionId', op.version_id, 'objectKey', op.object_key, 'ready', op.status = 'ready', 'reused', op.reused);
  end if;

  if p_source is not null then
    select * into source from public.experience_sources where id = p_source and owner_id = p_owner for update;

    if not found then raise exception 'source_not_found'; end if;
    if source.conversation_id is distinct from p_conversation then raise exception 'source_scope_mismatch'; end if;
    if source.status in ('deleting', 'delete-failed') then raise exception 'source_unavailable'; end if;

    select * into existing from public.experience_source_versions where source_id = p_source and content_hash = p_hash and source_kind = p_kind;
  else
    select v.* into existing from public.experience_source_versions v join public.experience_sources s on s.id = v.source_id
      where v.owner_id = p_owner and v.content_hash = p_hash and v.source_kind = p_kind and s.name = p_name
        and s.conversation_id is not distinct from p_conversation and s.status = 'ready' and s.current_version_id = v.id
      order by v.created_at desc limit 1;

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
    insert into public.experience_sources(owner_id, conversation_id, name, kind)
      values(p_owner, p_conversation, p_name, p_kind) returning * into source;
  end if;

  object_key := case when p_has_file then p_owner::text || '/' || source.id::text || '/' || new_version::text else null end;

  insert into public.experience_source_operations(owner_id, operation_id, source_id, version_id, request_hash, object_key)
    values(p_owner, p_operation, source.id, new_version, p_request_hash, object_key);

  return jsonb_build_object('source', to_jsonb(source), 'versionId', new_version, 'objectKey', object_key, 'ready', false, 'reused', false);
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
  else
    raise exception 'invalid_target';
  end if;

  if exists(select 1 from jsonb_array_elements(p_references) r where not exists (
    select 1 from public.experience_sources s join public.experience_source_versions v on v.source_id = s.id
    where s.id = (r->>'sourceId')::uuid and v.id = (r->>'versionId')::uuid and s.owner_id = p_owner and s.status = 'ready'
      and (s.conversation_id is null or (p_target = 'conversation' and s.conversation_id = p_target_id))
  )) then
    raise exception 'source_not_found';
  end if;

  delete from public.experience_source_relations where owner_id = p_owner and
    ((p_target = 'conversation' and conversation_id = p_target_id) or (p_target = 'resume' and resume_id = p_target_id));

  insert into public.experience_source_relations(owner_id, source_id, version_id, conversation_id, resume_id)
    select p_owner, (r->>'sourceId')::uuid, (r->>'versionId')::uuid,
      case when p_target = 'conversation' then p_target_id else null end,
      case when p_target = 'resume' then p_target_id else null end
    from jsonb_array_elements(p_references) r;
end;
$$;

revoke all on function public.reserve_experience_source(uuid, uuid, uuid, text, text, text, text, boolean, uuid) from public, anon, authenticated;
grant execute on function public.reserve_experience_source(uuid, uuid, uuid, text, text, text, text, boolean, uuid) to service_role;
