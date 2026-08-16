CREATE TABLE public.company (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL,
  resume_id uuid,
  company text NOT NULL,
  company_logo text,
  position text NOT NULL,
  location text NOT NULL,
  salary text,
  job_url text,
  status text NOT NULL DEFAULT 'saved',
  stage_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  interview_sub_stages jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT company_pkey PRIMARY KEY (id),
  CONSTRAINT company_resume_id_fkey
    FOREIGN KEY (resume_id) REFERENCES public.resume_config (resume_id) ON DELETE SET NULL,
  CONSTRAINT company_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT company_status_check
    CHECK (status IN ('saved', 'applied', 'screen', 'interview', 'offer', 'rejected'))
);

CREATE TRIGGER update_company_updated_at
  BEFORE UPDATE ON public.company
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
