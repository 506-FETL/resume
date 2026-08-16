ALTER TABLE public.resume_config
  ADD COLUMN IF NOT EXISTS spacing jsonb,
  ADD COLUMN IF NOT EXISTS font jsonb,
  ADD COLUMN IF NOT EXISTS theme jsonb;

UPDATE public.resume_config
SET
  spacing = coalesce(spacing, '{"sectionSpacing":20,"lineHeight":1.6,"pageMargin":16}'::jsonb),
  font = coalesce(font, '{"fontFamily":"system","fontSize":14}'::jsonb),
  theme = coalesce(theme, '{"theme":"default"}'::jsonb)
WHERE spacing IS NULL
  OR font IS NULL
  OR theme IS NULL;

ALTER TABLE public.resume_config
  ALTER COLUMN spacing SET DEFAULT '{"sectionSpacing":20,"lineHeight":1.6,"pageMargin":16}'::jsonb,
  ALTER COLUMN spacing SET NOT NULL,
  ALTER COLUMN font SET DEFAULT '{"fontFamily":"system","fontSize":14}'::jsonb,
  ALTER COLUMN font SET NOT NULL,
  ALTER COLUMN theme SET DEFAULT '{"theme":"default"}'::jsonb,
  ALTER COLUMN theme SET NOT NULL;
