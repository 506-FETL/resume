-- 20260728000002_add_company_next_action.sql
-- 为求职看板「下一步跟进」功能增加两列；均 nullable + 默认 null，老记录不受影响
-- next_action: 下一步动作文字描述；next_action_date: 计划执行/到期日期

ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS next_action text NULL,
  ADD COLUMN IF NOT EXISTS next_action_date date NULL;

CREATE INDEX IF NOT EXISTS idx_company_next_action_date
  ON public.company USING btree (next_action_date)
  WHERE next_action_date IS NOT NULL;
