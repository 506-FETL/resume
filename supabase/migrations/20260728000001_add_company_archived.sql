-- 20260728000001_add_company_archived.sql
-- 为求职看板归档功能增加 archived 列；非空 + 默认 false，老记录自动归为未归档，向后兼容

ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_company_archived
  ON public.company USING btree (archived)
  WHERE archived = true;
