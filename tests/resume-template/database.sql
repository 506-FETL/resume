-- 仅在 tests/resume-template/database.mjs 创建的隔离数据库执行；断言数据最终回滚。
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin
  if value is not true then raise exception 'ASSERT: %', message; end if;
end;
$$;
create function pg_temp.expect_error(statement text, expected_state text) returns void language plpgsql as $$
declare actual_state text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual_state = returned_sqlstate;
    if actual_state = expected_state then return; end if;
    raise exception 'Expected SQLSTATE %, received % for %', expected_state, actual_state, statement;
  end;
  raise exception 'Expected SQLSTATE %, statement succeeded: %', expected_state, statement;
end;
$$;
create function pg_temp.add_template(id text, overrides jsonb default '{}'::jsonb, published boolean default true) returns void language plpgsql as $$
declare value text;
begin
  select (content::jsonb || jsonb_build_object('templateId', id) || overrides)::text into value
  from public.official_resume_template_versions where template_id = 'default' and version = 2;
  insert into public.official_resume_template_versions(template_id, version, content, content_hash, published_at)
  values (id, (value::jsonb ->> 'version')::integer, value, encode(sha256(convert_to(value, 'UTF8')), 'hex'), case when published then now() else null end);
end;
$$;
create function pg_temp.check_public_role() returns void language plpgsql as $$
declare table_name text; operation text;
begin
  perform pg_temp.assert_true((select count(*) = 2 from public.official_resume_template_catalog), current_user || ' catalog mismatch');
  perform pg_temp.assert_true((select count(*) = 2 from public.official_resume_template_versions where version = 2), current_user || ' v2 read failed');
  perform pg_temp.assert_true((select count(*) = 2 from public.official_resume_example_versions where example_id in ('graduate', 'frontend')), current_user || ' examples mismatch');
  perform pg_temp.assert_true(not exists(select 1 from public.official_resume_template_versions where template_id = 'draft-only'), current_user || ' template draft leaked');
  perform pg_temp.assert_true(not exists(select 1 from public.official_resume_example_versions where example_id = 'draft-example'), current_user || ' example draft leaked');
  perform pg_temp.assert_true(not exists(select 1 from public.official_resume_assets where content_hash = encode(sha256(convert_to('asset-fixture-draft', 'UTF8')), 'hex')), current_user || ' asset draft leaked');
  perform pg_temp.assert_true(exists(select 1 from public.official_resume_assets where content_hash = encode(sha256(convert_to('asset-fixture-published', 'UTF8')), 'hex')), current_user || ' published asset unreadable');
  perform pg_temp.assert_true(jsonb_array_length(public.official_resume_template_facets() -> 'styles') = 2, current_user || ' facets mismatch');
  foreach table_name in array array['official_resume_template_catalog', 'official_resume_template_versions', 'official_resume_example_versions', 'official_resume_assets'] loop
    perform pg_temp.assert_true(has_table_privilege(current_user, 'public.' || table_name, 'SELECT'), current_user || ' missing read grant');
    foreach operation in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
      perform pg_temp.assert_true(not has_table_privilege(current_user, 'public.' || table_name, operation), current_user || ' excessive ' || operation || ' grant');
    end loop;
    perform pg_temp.expect_error(format('insert into public.%I default values', table_name), '42501');
    perform pg_temp.expect_error(format('delete from public.%I where false', table_name), '42501');
    perform pg_temp.expect_error(format('update public.%I set %I = %I where false', table_name, case when table_name = 'official_resume_template_catalog' then 'listed' else 'published_at' end, case when table_name = 'official_resume_template_catalog' then 'listed' else 'published_at' end), '42501');
  end loop;
end;
$$;

-- 新目录仅引用 v2；旧版本静态档案不能再次挂入目录。
select pg_temp.assert_true((select count(*) = 2 from public.official_resume_template_catalog where current_version = 2 and metadata ->> 'schemaVersion' = '2'), 'new catalog must use v2');
select pg_temp.assert_true((select count(*) = 2 from public.official_resume_template_versions where version = 1), 'legacy published archives retained');
select pg_temp.expect_error($sql$update public.official_resume_template_catalog set current_version = 1, metadata = jsonb_set(metadata, '{currentVersion}', '1') where template_id = 'default'$sql$, '23514');
select pg_temp.expect_error($sql$select pg_temp.add_template('old-schema', '{"schemaVersion":1}')$sql$, '23514');
select pg_temp.expect_error($sql$select pg_temp.add_template('old-contract', '{"renderContract":"resume-v1"}')$sql$, '23514');
select pg_temp.expect_error($sql$select pg_temp.add_template('missing-schema', '{"schemaVersion":null}')$sql$, '23514');
select pg_temp.expect_error($sql$insert into public.official_resume_template_versions(template_id,version,content,content_hash) select 'bad-hash',2,jsonb_set(content::jsonb,'{templateId}','"bad-hash"')::text,repeat('0',64) from public.official_resume_template_versions where template_id='default' and version=2$sql$, '23514');

-- 草稿跨三类资源隔离；已发布资源不可修改或删除。
select pg_temp.add_template('draft-only', '{}', false);
insert into public.official_resume_example_versions(example_id,version,content,content_hash)
select 'draft-example',1,c,encode(sha256(convert_to(c,'UTF8')),'hex') from (
  select jsonb_set(content::jsonb,'{exampleId}','"draft-example"')::text c from public.official_resume_example_versions where example_id='graduate' and version=1
) source;
insert into public.official_resume_assets(content_hash,mime_type,byte_size,width,height,content_base64,published_at)
select encode(sha256(convert_to(value,'UTF8')),'hex'),'image/png',octet_length(value),1,1,encode(convert_to(value,'UTF8'),'base64'),published_at
from (values ('asset-fixture-draft',null::timestamptz),('asset-fixture-published',now())) fixture(value,published_at);
select pg_temp.expect_error($sql$update public.official_resume_template_versions set published_at = null where template_id='default' and version=2$sql$, '23514');
select pg_temp.expect_error($sql$delete from public.official_resume_template_versions where template_id='classic-ribbon' and version=2$sql$, '23514');
select pg_temp.expect_error($sql$update public.official_resume_example_versions set published_at = null where example_id='graduate'$sql$, '23514');
select pg_temp.expect_error($sql$delete from public.official_resume_example_versions where example_id='frontend'$sql$, '23514');
select pg_temp.expect_error($sql$update public.official_resume_assets set width=2 where published_at is not null$sql$, '23514');
select pg_temp.expect_error($sql$delete from public.official_resume_assets where published_at is not null$sql$, '23514');
select pg_temp.expect_error($sql$insert into public.official_resume_assets(content_hash,mime_type,byte_size,width,height,content_base64) values(repeat('0',64),'image/png',1,1,1,'eA==')$sql$, '23514');
select pg_temp.expect_error($sql$insert into public.official_resume_assets(content_hash,mime_type,byte_size,width,height,content_base64) select encode(sha256(convert_to('wrong-size','UTF8')),'hex'),'image/png',1,1,1,encode(convert_to('wrong-size','UTF8'),'base64')$sql$, '23514');

set local role anon;
select pg_temp.check_public_role();
reset role;
set local role authenticated;
select pg_temp.check_public_role();
reset role;

-- 发布依赖必须精确匹配；允许无效素材草稿，但发布转换必须重新检查。
select pg_temp.expect_error($sql$select pg_temp.add_template('missing-asset', '{"assets":[{"sha256":"0000000000000000000000000000000000000000000000000000000000000000","mimeType":"image/png","bytes":1,"width":1,"height":1}]}')$sql$, '23514');
select pg_temp.expect_error($sql$select pg_temp.add_template('draft-asset', jsonb_build_object('assets',jsonb_build_array(jsonb_build_object('sha256',encode(sha256(convert_to('asset-fixture-draft','UTF8')),'hex'),'mimeType','image/png','bytes',19,'width',1,'height',1))))$sql$, '23514');
select pg_temp.add_template('asset-publish-draft', '{"assets":[{"sha256":"0000000000000000000000000000000000000000000000000000000000000000","mimeType":"image/png","bytes":1,"width":1,"height":1}]}', false);
select pg_temp.expect_error($sql$update public.official_resume_template_versions set published_at=now() where template_id='asset-publish-draft'$sql$, '23514');
select pg_temp.add_template('exact-asset', jsonb_build_object('assets',jsonb_build_array(jsonb_build_object('sha256',encode(sha256(convert_to('asset-fixture-published','UTF8')),'hex'),'mimeType','image/png','bytes',octet_length('asset-fixture-published'),'width',1,'height',1))));
select pg_temp.expect_error($sql$select pg_temp.add_template('wrong-asset-size', jsonb_build_object('assets',jsonb_build_array(jsonb_build_object('sha256',encode(sha256(convert_to('asset-fixture-published','UTF8')),'hex'),'mimeType','image/png','bytes',1,'width',1,'height',1))))$sql$, '23514');

-- 合成精确预览，再逐个改变依赖；触发器应拒绝每个失配。
create temporary table preview_fixture as select jsonb_build_object(
  'templateId','default','templateVersion',2,'example',jsonb_build_object('exampleId','graduate','version',1),
  'appearance',definition.content::jsonb -> 'appearanceDefaults', 'projectionReferenceDate',example.content::jsonb ->> 'projectionReferenceDate',
  'asset',jsonb_build_object('hash',asset.content_hash,'mimeType',asset.mime_type,'byteLength',asset.byte_size,'width',asset.width,'height',asset.height)
) value from public.official_resume_template_versions definition cross join public.official_resume_example_versions example cross join public.official_resume_assets asset
where definition.template_id='default' and definition.version=2 and example.example_id='graduate' and example.version=1
and asset.content_hash=encode(sha256(convert_to('asset-fixture-published','UTF8')),'hex');
update public.official_resume_template_catalog set metadata=jsonb_set(metadata,'{previews}',jsonb_build_array((select value from preview_fixture))) where template_id='default';
select pg_temp.expect_error($sql$update public.official_resume_template_catalog set metadata=jsonb_set(metadata,'{previews,0,templateVersion}','3') where template_id='default'$sql$, '23514');
select pg_temp.expect_error($sql$update public.official_resume_template_catalog set metadata=jsonb_set(metadata,'{previews,0,templateId}','"classic-ribbon"') where template_id='default'$sql$, '23514');
select pg_temp.expect_error($sql$update public.official_resume_template_catalog set metadata=jsonb_set(metadata,'{previews,0,appearance,font,fontSize}','99') where template_id='default'$sql$, '23514');
select pg_temp.expect_error($sql$update public.official_resume_template_catalog set metadata=jsonb_set(metadata,'{previews,0,projectionReferenceDate}','"2020-01-01"') where template_id='default'$sql$, '23514');
select pg_temp.expect_error($sql$update public.official_resume_template_catalog set metadata=jsonb_set(metadata,'{previews,0,example,version}','99') where template_id='default'$sql$, '23514');
select pg_temp.expect_error($sql$update public.official_resume_template_catalog set metadata=jsonb_set(metadata,'{previews,0,asset,width}','99') where template_id='default'$sql$, '23514');
select pg_temp.expect_error($sql$update public.official_resume_template_catalog set metadata=jsonb_set(metadata,'{defaultExample,version}','99') where template_id='default'$sql$, '23514');
select pg_temp.expect_error($sql$update public.official_resume_template_catalog set metadata=jsonb_set(metadata,'{examples,0,version}','99') where template_id='default'$sql$, '23514');

-- 下架目录保留精确版本可读性。
update public.official_resume_template_catalog set listed=false where template_id='classic-ribbon';
set local role anon;
select pg_temp.assert_true((select count(*) = 1 from public.official_resume_template_catalog),'unlisted catalog leaked');
select pg_temp.assert_true(exists(select 1 from public.official_resume_template_versions where template_id='classic-ribbon' and version=2),'unlisted exact version unreadable');
reset role;

-- 目录分页在 1000 行时仍使用顺序索引，附实际 EXPLAIN 证据。
insert into public.official_resume_template_versions(template_id,version,content,content_hash,published_at)
select id,2,c,encode(sha256(convert_to(c,'UTF8')),'hex'),now() from (
  select 'fixture-'||n id,jsonb_set(content::jsonb,'{templateId}',to_jsonb('fixture-'||n))::text c
  from public.official_resume_template_versions cross join generate_series(1,1000) n where template_id='default' and version=2
) source;
insert into public.official_resume_template_catalog(template_id,current_version,sort_order,listed,metadata)
select 'fixture-'||n,2,n+10,true,jsonb_set(jsonb_set(metadata,'{previews}','[]'),'{templateId}',to_jsonb('fixture-'||n))
from public.official_resume_template_catalog cross join generate_series(1,1000) n where template_id='default';
analyze public.official_resume_template_catalog;
set local role anon;
explain (analyze, buffers) select metadata from public.official_resume_template_catalog where listed and style='简约' order by sort_order,template_id limit 13;
reset role;
select 'PASS v2 identity, hash integrity, anon/auth read-only RLS, three draft types, immutability, exact assets/previews, unlisting and 1000-row pagination' as result;
rollback;
