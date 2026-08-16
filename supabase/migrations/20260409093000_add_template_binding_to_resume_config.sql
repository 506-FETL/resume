ALTER TABLE public.resume_config
  ADD COLUMN IF NOT EXISTS template_binding jsonb;

ALTER TABLE public.resume_config
  DROP CONSTRAINT IF EXISTS resume_config_template_binding_is_object_check;

ALTER TABLE public.resume_config
  ADD CONSTRAINT resume_config_template_binding_is_object_check
  CHECK (
    template_binding IS NULL
    OR jsonb_typeof(template_binding) = 'object'
  );
