-- JD 只读沿用投递记录与岗位双重归属 RLS；原件和内部请求字段继续不可直接读取。
grant select (jd_text) on public.job_submissions to authenticated;
