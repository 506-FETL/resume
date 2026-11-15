-- 新建档案的名称是用户的保存意图；同内容异名不能复用旧档案并丢弃新名称。
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
      where v.owner_id = p_owner and v.content_hash = p_hash and v.source_kind = p_kind and s.name = p_name and s.status = 'ready' and s.current_version_id = v.id order by v.created_at desc limit 1;
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

revoke all on function public.reserve_experience_source(uuid, uuid, uuid, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.reserve_experience_source(uuid, uuid, uuid, text, text, text, text, boolean) to service_role;
