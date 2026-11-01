-- 最新报告在数据库中选定，列表和首页不下载历史建议来做去重。
create view public.latest_ats_reports
with (security_invoker = true)
as
select distinct on (resume_id)
  id,
  user_id,
  resume_id,
  created_at,
  summary -> 'overall_score' as overall_score,
  findings
from public.ats
order by resume_id, created_at desc, id desc;

revoke all on public.latest_ats_reports from public, anon, authenticated;
grant select on public.latest_ats_reports to authenticated;
