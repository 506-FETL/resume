-- 列表只展示 JD 开头；原文继续由任务详情按需读取。
-- 匿名复合参数使 PostgREST 仅将其作为计算字段，不暴露独立 RPC。
create function public.resume_jd_excerpt(public.resume_config)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select left($1.linked_jd_text, 80)
$$;

revoke all on function public.resume_jd_excerpt(public.resume_config) from public, anon;
grant execute on function public.resume_jd_excerpt(public.resume_config) to authenticated;
