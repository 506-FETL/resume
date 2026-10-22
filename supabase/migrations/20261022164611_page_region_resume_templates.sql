-- 新写入只接受分区声明式 v3；旧发布行作为不可变档案留存，不参与新目录。
alter table public.official_resume_template_versions drop constraint template_identity;
alter table public.official_resume_template_versions add constraint template_identity check (
  jsonb_typeof(content::jsonb) = 'object'
  and (content::jsonb ->> 'templateId') is not distinct from template_id
  and (content::jsonb ->> 'version')::integer is not distinct from version
  and (content::jsonb ->> 'schemaVersion')::integer is not distinct from 3
  and (content::jsonb ->> 'renderContract') is not distinct from 'declarative-page@1'
  and jsonb_typeof(content::jsonb -> 'assets') is not distinct from 'array'
) not valid;

-- 当前目录必须绑定新协议与完整精确预览；历史资源仍保留为不可变档案。
create or replace function public.validate_official_resume_catalog() returns trigger
language plpgsql set search_path = '' as $$
declare item jsonb; preview jsonb; definition jsonb; example jsonb;
begin
  select content::jsonb into definition from public.official_resume_template_versions
    where template_id = new.template_id and version = new.current_version and published_at is not null;
  if definition is null or definition ->> 'schemaVersion' is distinct from '3'
    or definition ->> 'renderContract' is distinct from 'declarative-page@1'
    or new.metadata ->> 'schemaVersion' is distinct from '3'
    or new.metadata ->> 'renderContract' is distinct from 'declarative-page@1'
    or jsonb_typeof(new.metadata -> 'previews') is distinct from 'array' then
    raise exception 'Catalog requires a published declarative template' using errcode = '23514';
  end if;
  if jsonb_typeof(new.metadata -> 'examples') is distinct from 'array'
    or jsonb_array_length(new.metadata -> 'examples') not between 1 and 30
    or jsonb_array_length(new.metadata -> 'previews') <> jsonb_array_length(new.metadata -> 'examples') then
    raise exception 'Catalog requires exactly one preview per candidate example' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_array_elements(new.metadata -> 'examples') e
    group by e ->> 'exampleId', e ->> 'version' having count(*) > 1)
    or exists (select 1 from jsonb_array_elements(new.metadata -> 'previews') p
    group by p #>> '{example,exampleId}', p #>> '{example,version}' having count(*) > 1) then
    raise exception 'Catalog examples and previews must have unique identities' using errcode = '23514';
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
