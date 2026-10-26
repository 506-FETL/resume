-- NULL purpose is intentional: existing links keep their source and visibility.
alter table public.resume_shares
  add column purpose text check (purpose in ('review', 'application', 'showcase')),
  add column show_phone boolean not null default true,
  add column show_email boolean not null default true;

create function public.enforce_resume_share_purpose()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.purpose is distinct from old.purpose then
    raise exception '分享用途不能修改，请创建新的链接';
  end if;

  if new.purpose in ('review', 'showcase') and new.source_kind <> 'current' then
    raise exception '审阅和公开展示分享应随已保存内容更新';
  end if;

  if new.purpose = 'application' and new.source_kind <> 'history' then
    raise exception '正式投递分享必须固定历史版本';
  end if;

  if new.purpose = 'application' and not exists (
    select 1 from public.resume_config_versions v
    where v.id = new.version_id and v.resume_id = new.resume_id
      and v.user_id = new.user_id and v.status = 'frozen'
  ) then
    raise exception '正式投递分享必须使用自己的已保存固定版本';
  end if;

  if new.purpose = 'showcase' or not new.show_phone or not new.show_email then
    new.allow_comments := false;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_resume_share_purpose() from public;

create trigger enforce_resume_share_purpose
before insert or update on public.resume_shares
for each row execute function public.enforce_resume_share_purpose();

create function public.validate_resume_version_job_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.company_id is not null and not exists (
    select 1 from public.company c
    where c.id = new.company_id and c.user_id = new.user_id
  ) then
    raise exception '历史版本只能关联自己的岗位';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_resume_version_job_owner() from public;

create trigger validate_resume_version_job_owner
before insert or update of company_id, user_id on public.resume_config_versions
for each row execute function public.validate_resume_version_job_owner();
