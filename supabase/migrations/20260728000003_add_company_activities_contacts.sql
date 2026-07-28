-- 20260728000003_add_company_activities_contacts.sql
-- 为求职看板「活动时间线」与「联系人」功能增加两列 jsonb 数组；默认空数组，老记录不受影响
-- activities: 活动/状态变更记录数组；contacts: 联系人（recruiter/内推人）数组

ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS contacts jsonb NOT NULL DEFAULT '[]'::jsonb;
