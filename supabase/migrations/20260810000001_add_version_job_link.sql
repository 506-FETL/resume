-- 为历史版本增加「关联岗位 + 投递日期」；均 nullable，老数据不受影响。
-- company_id 关联求职看板岗位，岗位删除时置空（版本保留）。

ALTER TABLE public.resume_config_versions
  ADD COLUMN IF NOT EXISTS company_id uuid NULL,
  ADD COLUMN IF NOT EXISTS submitted_at date NULL;

ALTER TABLE public.resume_config_versions
  ADD CONSTRAINT resume_config_versions_company_id_fkey
    FOREIGN KEY (company_id)
    REFERENCES public.company (id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resume_config_versions_company_id
  ON public.resume_config_versions USING btree (company_id)
  WHERE company_id IS NOT NULL;
