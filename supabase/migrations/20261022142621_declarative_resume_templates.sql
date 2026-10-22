-- 新写入只接受声明式 v2；旧发布行作为不可变档案留存，不参与新目录。
alter table public.official_resume_template_versions drop constraint template_identity;
alter table public.official_resume_template_versions add constraint template_identity check (
  jsonb_typeof(content::jsonb) = 'object'
  and (content::jsonb ->> 'templateId') is not distinct from template_id
  and (content::jsonb ->> 'version')::integer is not distinct from version
  and (content::jsonb ->> 'schemaVersion')::integer is not distinct from 2
  and (content::jsonb ->> 'renderContract') is not distinct from 'declarative-flow@1'
  and jsonb_typeof(content::jsonb -> 'assets') is not distinct from 'array'
) not valid;

-- 首批受控小图采用与定义相同的公开资源通道；客户端不持有上传凭据。
create table public.official_resume_assets (
  content_hash text primary key check (content_hash ~ '^[0-9a-f]{64}$'),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 524288),
  width integer not null check (width between 1 and 4096),
  height integer not null check (height between 1 and 4096),
  content_base64 text not null,
  published_at timestamptz,
  constraint asset_integrity check (
    octet_length(decode(content_base64, 'base64')) = byte_size
    and encode(sha256(decode(content_base64, 'base64')), 'hex') = content_hash
  )
);
alter table public.official_resume_assets enable row level security;
revoke all on public.official_resume_assets from public, anon, authenticated;
grant select on public.official_resume_assets to anon, authenticated;
grant all on public.official_resume_assets to service_role;
create policy "Read published official assets" on public.official_resume_assets for select to anon, authenticated using (published_at is not null);
create trigger protect_official_asset before update or delete on public.official_resume_assets
for each row execute function public.protect_official_resume_resource();

create function public.validate_official_template_assets() returns trigger
language plpgsql set search_path = '' as $$
declare asset jsonb;
begin
  if new.published_at is null then return new; end if;
  for asset in select * from jsonb_array_elements(new.content::jsonb -> 'assets') loop
    if not exists (select 1 from public.official_resume_assets a
      where a.content_hash = asset ->> 'sha256' and a.published_at is not null
        and a.mime_type = asset ->> 'mimeType' and a.byte_size = (asset ->> 'bytes')::integer
        and a.width = (asset ->> 'width')::integer and a.height = (asset ->> 'height')::integer) then
      raise exception 'Template requires exact published assets' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.validate_official_template_assets() from public, anon, authenticated;
create trigger validate_official_template_assets before insert or update on public.official_resume_template_versions
for each row execute function public.validate_official_template_assets();

create or replace function public.validate_official_resume_catalog() returns trigger
language plpgsql set search_path = '' as $$
declare item jsonb; preview jsonb; definition jsonb; example jsonb;
begin
  select content::jsonb into definition from public.official_resume_template_versions
    where template_id = new.template_id and version = new.current_version and published_at is not null;
  if definition is null or definition ->> 'schemaVersion' is distinct from '2'
    or definition ->> 'renderContract' is distinct from 'declarative-flow@1'
    or new.metadata ->> 'schemaVersion' is distinct from '2'
    or new.metadata ->> 'renderContract' is distinct from 'declarative-flow@1'
    or jsonb_typeof(new.metadata -> 'previews') is distinct from 'array' then
    raise exception 'Catalog requires a published declarative template' using errcode = '23514';
  end if;
  if not exists (select 1 from jsonb_array_elements(new.metadata -> 'examples') as e
    where e ->> 'exampleId' = new.metadata #>> '{defaultExample,exampleId}'
      and e ->> 'version' = new.metadata #>> '{defaultExample,version}') then
    raise exception 'Default example must be present in catalog examples' using errcode = '23514';
  end if;
  for item in select * from jsonb_array_elements(new.metadata -> 'examples') loop
    if not exists (select 1 from public.official_resume_example_versions
      where example_id = item ->> 'exampleId' and version = (item ->> 'version')::integer and published_at is not null) then
      raise exception 'Catalog must reference published example versions' using errcode = '23514';
    end if;
  end loop;
  for preview in select * from jsonb_array_elements(new.metadata -> 'previews') loop
    select content::jsonb into example from public.official_resume_example_versions
      where example_id = preview #>> '{example,exampleId}' and version = (preview #>> '{example,version}')::integer and published_at is not null;
    if preview ->> 'templateId' is distinct from new.template_id
      or (preview ->> 'templateVersion')::integer is distinct from new.current_version
      or preview -> 'appearance' is distinct from definition -> 'appearanceDefaults'
      or example is null
      or preview ->> 'projectionReferenceDate' is distinct from example ->> 'projectionReferenceDate'
      or not exists (select 1 from jsonb_array_elements(new.metadata -> 'examples') e
        where e ->> 'exampleId' = preview #>> '{example,exampleId}' and e ->> 'version' = preview #>> '{example,version}')
      or not exists (select 1 from public.official_resume_assets a
        where a.content_hash = preview #>> '{asset,hash}' and a.published_at is not null
          and a.mime_type = preview #>> '{asset,mimeType}'
          and a.byte_size = (preview #>> '{asset,byteLength}')::integer
          and a.width = (preview #>> '{asset,width}')::integer and a.height = (preview #>> '{asset,height}')::integer) then
      raise exception 'Preview must match exact template, example, appearance and published asset' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;
