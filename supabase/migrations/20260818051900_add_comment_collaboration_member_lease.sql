-- 为每次 guest join 分配服务端条件化 lease，防止旧 leave 延迟到达后
-- 撤销同一用户在同一 session 中更新建立的成员资格。

ALTER TABLE public.resume_comment_collaboration_members
  ADD COLUMN IF NOT EXISTS member_lease_id uuid;

ALTER TABLE public.resume_comment_collaboration_members
  ALTER COLUMN member_lease_id SET DEFAULT gen_random_uuid();

UPDATE public.resume_comment_collaboration_members
SET member_lease_id = gen_random_uuid()
WHERE member_lease_id IS NULL;

ALTER TABLE public.resume_comment_collaboration_members
  ALTER COLUMN member_lease_id SET NOT NULL;

-- 现有主键 (session_id, user_id) 已将 guest leave 定位到单行，
-- member_lease_id 只作为该行的条件更新令牌，不需要额外索引。
