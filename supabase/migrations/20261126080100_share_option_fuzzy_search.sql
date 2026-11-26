-- cmdk 将空白、连字符折叠为空格。以每个前缀最早可达的位置判定有序跳字、
-- 相邻换位和重复输入，避免给 SQL 的 LIKE 或正则传入用户输入。
create function private.share_option_match(p_value text, p_keyword text)
returns integer language plpgsql immutable strict parallel safe security invoker set search_path = ''
as $$
declare
  value text := regexp_replace(lower(p_value), '[[:space:]-]', ' ', 'g');
  keyword text := regexp_replace(lower(p_keyword), '[[:space:]-]', ' ', 'g');
  before_pair integer := -1;
  before_char integer := 0;
  next_pos integer;
  pair_pos integer;
  start_pos integer;
  previous_char text;
  current_char text;
begin
  if keyword = '' or strpos(value, keyword) > 0 then return 2; end if;

  for i in 1..length(keyword) loop
    current_char := substr(keyword, i, 1);
    next_pos := -1;

    if before_char >= 0 then
      next_pos := strpos(substr(value, before_char + 1), current_char);
      next_pos := case when next_pos > 0 then before_char + next_pos else -1 end;
    end if;

    if before_pair >= 0 then
      if previous_char <> current_char then
        start_pos := greatest(1, before_pair);
        pair_pos := strpos(substr(value, start_pos), current_char || previous_char);
        pair_pos := case when pair_pos > 0 then start_pos + pair_pos else -1 end;
      else
        pair_pos := strpos(substr(value, before_pair + 1), current_char);
        pair_pos := case when pair_pos > 0 then before_pair + pair_pos else -1 end;
      end if;

      if pair_pos > 0 and (next_pos < 0 or pair_pos < next_pos) then
        next_pos := pair_pos;
      end if;
    end if;

    if next_pos < 0 and before_char < 0 then return 0; end if;
    before_pair := before_char;
    before_char := next_pos;
    previous_char := current_char;
  end loop;

  return case when before_char > 0 then 1 else 0 end;
end;
$$;

revoke all on function private.share_option_match(text,text) from public, anon, authenticated, service_role;
grant execute on function private.share_option_match(text,text) to authenticated;

create or replace function public.get_share_resume_options(p_keyword text, p_offset integer)
returns table(resume_id uuid, display_name text)
language sql stable security invoker set search_path = ''
as $$
  select r.resume_id, name.display_name
  from public.resume_config r
  cross join lateral (select coalesce(nullif(r.display_name, ''), '未命名简历') as display_name) name
  cross join lateral (
    select case when p_keyword = '' then 2 else
      private.share_option_match(name.display_name || ' ' || r.resume_id::text, p_keyword)
    end as score offset 0
  ) matched
  where r.user_id = (select auth.uid()) and matched.score > 0
  order by matched.score desc, name.display_name, r.resume_id
  offset greatest(0, p_offset)
  limit 21
$$;

create or replace function public.get_share_version_options(p_resume_id uuid, p_keyword text, p_offset integer)
returns table(id bigint, version_no integer, version_name text, milestone_name text, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select v.id, v.version_no, v.version_name, v.milestone_name, v.created_at
  from public.resume_config_versions v
  cross join lateral (
    select case when p_keyword = '' then 2 else private.share_option_match(
      'V' || v.version_no::text || ' ' ||
      coalesce(nullif(trim(v.version_name), ''), nullif(trim(v.milestone_name), ''), '未命名版本') ||
      ' ' || coalesce(v.version_name, '') || ' ' || coalesce(v.milestone_name, ''), p_keyword)
    end as score offset 0
  ) matched
  where v.user_id = (select auth.uid()) and v.resume_id = p_resume_id and v.status = 'frozen'
    and matched.score > 0
  order by matched.score desc, v.version_no desc
  offset greatest(0, p_offset)
  limit 21
$$;
