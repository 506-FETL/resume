-- 在隔离数据库执行，全部测试数据在事务末尾回滚。
\set ON_ERROR_STOP on
begin;
set local role anon;
do $$ begin
  if (select count(*) from public.official_resume_template_catalog) <> 2 then raise exception 'anonymous catalog mismatch'; end if;
  if (select count(*) from public.official_resume_template_versions) <> 2 then raise exception 'anonymous versions mismatch'; end if;
  if jsonb_array_length(public.official_resume_template_facets() -> 'styles') <> 2 then raise exception 'facet mismatch'; end if;
  begin
    update public.official_resume_template_catalog set listed=false;
    raise exception 'anonymous write allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  if (select count(*) from public.official_resume_example_versions) <> 2 then raise exception 'authenticated examples mismatch'; end if;
  begin
    delete from public.official_resume_template_versions;
    raise exception 'authenticated delete allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  begin
    update public.official_resume_template_versions set published_at=null where template_id='default';
    raise exception 'published version mutable';
  exception when check_violation then null;
  end;
  begin
    delete from public.official_resume_example_versions where example_id='graduate';
    raise exception 'published example deletable';
  exception when check_violation then null;
  end;
end $$;
insert into public.official_resume_template_versions(template_id,version,content,content_hash)
select 'draft-only',1,c,encode(sha256(convert_to(c,'UTF8')),'hex') from (select jsonb_set(content::jsonb,'{templateId}','"draft-only"')::text c from public.official_resume_template_versions where template_id='default') s;
set local role anon;
do $$ begin
  if exists(select 1 from public.official_resume_template_versions where template_id='draft-only') then raise exception 'draft leaked'; end if;
end $$;
reset role;
update public.official_resume_template_catalog set listed=false where template_id='classic-ribbon';
set local role anon;
do $$ begin
  if (select count(*) from public.official_resume_template_catalog) <> 1 then raise exception 'unlisted catalog leaked'; end if;
  if not exists(select 1 from public.official_resume_template_versions where template_id='classic-ribbon') then raise exception 'unlisted version not readable'; end if;
end $$;
reset role;
insert into public.official_resume_template_versions(template_id,version,content,content_hash,published_at)
select id,1,c,encode(sha256(convert_to(c,'UTF8')),'hex'),now() from (
  select 'fixture-'||n id,jsonb_set(content::jsonb,'{templateId}',to_jsonb('fixture-'||n))::text c
  from public.official_resume_template_versions cross join generate_series(1,1000) n where template_id='default'
) s;
insert into public.official_resume_template_catalog(template_id,current_version,sort_order,listed,metadata)
select 'fixture-'||n,1,n+10,true,jsonb_set(metadata,'{templateId}',to_jsonb('fixture-'||n))
from public.official_resume_template_catalog cross join generate_series(1,1000) n where template_id='default';
analyze public.official_resume_template_catalog;
set local role anon;
explain (analyze, buffers) select metadata from public.official_resume_template_catalog where listed and style='简约' order by sort_order,template_id limit 13;
reset role;
select 'PASS roles, RLS, immutable versions, drafts, unlisting, 1000-row indexed pagination' as result;
rollback;
