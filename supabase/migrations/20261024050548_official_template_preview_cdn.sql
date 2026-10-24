-- 内容寻址的公开缩略图；发布记录仍以 official_resume_assets 为权威。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resume-template-previews', 'resume-template-previews', true, 524288,
  array['image/png', 'image/jpeg', 'image/webp']);

-- RESTRICTIVE 与其他许可策略取交集，既有或未来的宽泛策略也不能开放此桶写入。
create policy official_previews_no_client_insert on storage.objects as restrictive
for insert to anon, authenticated with check (bucket_id <> 'resume-template-previews');
create policy official_previews_no_client_update on storage.objects as restrictive
for update to anon, authenticated
using (bucket_id <> 'resume-template-previews') with check (bucket_id <> 'resume-template-previews');
create policy official_previews_no_client_delete on storage.objects as restrictive
for delete to anon, authenticated using (bucket_id <> 'resume-template-previews');

-- 桶配置同样不能被客户端宽泛策略修改或删除；其他桶的策略结果不变。
create policy official_previews_no_client_bucket_insert on storage.buckets as restrictive
for insert to anon, authenticated with check (id <> 'resume-template-previews');
create policy official_previews_no_client_bucket_update on storage.buckets as restrictive
for update to anon, authenticated
using (id <> 'resume-template-previews') with check (id <> 'resume-template-previews');
create policy official_previews_no_client_bucket_delete on storage.buckets as restrictive
for delete to anon, authenticated using (id <> 'resume-template-previews');

-- 不替换既有发布/精确引用校验，不更新或遍历历史目录。
-- 仅维护角色可写目录，使用调用者的 SELECT 权限，不添加 SECURITY DEFINER。
create function public.validate_official_preview_cdn() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare preview jsonb;
begin
  if not new.listed then return new; end if;
  -- 同值赋值和仅调整分类/排序等写入不需要重新检查历史预览。
  if tg_op = 'UPDATE' then
    if old.listed and new.template_id is not distinct from old.template_id
      and new.current_version is not distinct from old.current_version
      and new.metadata -> 'previews' is not distinct from old.metadata -> 'previews' then
      return new;
    end if;
  end if;
  for preview in select * from jsonb_array_elements(new.metadata -> 'previews') loop
    if not exists (
      select 1 from storage.objects o
      join public.official_resume_assets a on a.content_hash = o.name
      where o.bucket_id = 'resume-template-previews'
        and o.name = preview #>> '{asset,hash}'
        and o.archived_at is null and o.is_delete_marker is not true
        and a.published_at is not null
        and a.mime_type = preview #>> '{asset,mimeType}'
        and a.byte_size = (preview #>> '{asset,byteLength}')::integer
        and a.width = (preview #>> '{asset,width}')::integer
        and a.height = (preview #>> '{asset,height}')::integer
        and o.metadata ->> 'size' = a.byte_size::text
        and o.metadata ->> 'mimetype' = a.mime_type
    ) then
      raise exception 'Listed preview requires an exact published asset in preview CDN' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.validate_official_preview_cdn() from public, anon, authenticated;
create trigger validate_official_preview_cdn
before insert or update of listed, template_id, current_version, metadata
on public.official_resume_template_catalog
for each row execute function public.validate_official_preview_cdn();
