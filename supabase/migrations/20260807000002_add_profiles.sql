-- 20260807000002_add_profiles.sql
-- 用户资料表 public.profiles。前端 getUserProfile() 按 id 查 full_name/avatar_url/updated_at。
-- owner-only RLS；新用户经 auth.users 触发器自动建档；对存量用户做一次性回填。
-- full_name / avatar_url 优先取 auth.users.raw_user_meta_data 中的对应字段。

-- ============ 表：profiles ============
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 仅本人可读写自己的资料（DROP IF EXISTS 保证可重复执行）
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ 新用户自动建档 ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ 存量用户一次性回填 ============
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT
  u.id,
  u.raw_user_meta_data ->> 'full_name',
  u.raw_user_meta_data ->> 'avatar_url'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
