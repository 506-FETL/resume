-- 20260804000003_add_chat_uploads_bucket.sql
-- AI 助手：聊天图片私有 bucket。对象路径 {user_id}/{conversation_id}/{uuid}.{ext}，
-- 仅允许用户读写自己 user_id 前缀下的对象。私有 bucket，前端用签名 URL 访问。

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-uploads', 'chat-uploads', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_uploads_select_own" ON storage.objects;
CREATE POLICY "chat_uploads_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
DROP POLICY IF EXISTS "chat_uploads_insert_own" ON storage.objects;
CREATE POLICY "chat_uploads_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
DROP POLICY IF EXISTS "chat_uploads_update_own" ON storage.objects;
CREATE POLICY "chat_uploads_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'chat-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
DROP POLICY IF EXISTS "chat_uploads_delete_own" ON storage.objects;
CREATE POLICY "chat_uploads_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
