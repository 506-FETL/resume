-- 旧简历缺少更新时间时仍按创建时间参与首页排序。
create view public.dashboard_resume_cards
with (security_invoker = true)
as
select id, user_id, resume_id, created_at, coalesce(updated_at, created_at) as updated_at,
  type, display_name, parent_resume_id, template_binding
from public.resume_config;

revoke all on public.dashboard_resume_cards from public, anon, authenticated, service_role;
grant select on public.dashboard_resume_cards to authenticated;
