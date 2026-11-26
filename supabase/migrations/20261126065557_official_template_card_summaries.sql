-- 原图内容哈希决定缩略图身份，新发布的原图可在小图就绪前正常上架。
create table public.official_template_card_previews (
  source_hash text primary key references public.official_resume_assets(content_hash),
  card_hash text not null check (card_hash ~ '^[a-f0-9]{64}$'),
  byte_size integer not null check (byte_size between 1 and 524288),
  width integer not null check (width between 1 and 512),
  height integer not null check (height between 1 and 4096)
);

alter table public.official_template_card_previews enable row level security;
revoke all on public.official_template_card_previews from public, anon, authenticated, service_role;
grant select on public.official_template_card_previews to anon, authenticated, service_role;
grant insert on public.official_template_card_previews to service_role;
create policy read_published_card_previews on public.official_template_card_previews
for select to anon, authenticated using (true);

create function public.validate_official_card_preview() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.official_resume_assets as a
    join storage.objects as o
      on o.bucket_id = 'resume-template-previews' and o.name = new.card_hash
    where a.content_hash = new.source_hash and a.published_at is not null
      and new.width = least(a.width, 512)
      and new.height = greatest(1, round(a.height::numeric * new.width / a.width))
      and o.archived_at is null and o.is_delete_marker is not true
      and o.metadata ->> 'mimetype' = 'image/webp'
      and o.metadata ->> 'size' = new.byte_size::text
  ) then
    raise exception 'Card preview requires an exact published source and CDN object'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_official_card_preview() from public, anon, authenticated;
create trigger validate_official_card_preview before insert or update
on public.official_template_card_previews for each row
execute function public.validate_official_card_preview();

-- 默认示例可能位于数组中的任意位置。先按筛选和分页定位卡片，再读取对应资产。
create view public.official_template_card_summaries
with (security_invoker = true) as
select
  c.template_id,
  c.current_version,
  c.sort_order,
  c.style,
  c.layout,
  c.metadata ->> 'name' as name,
  c.metadata ->> 'description' as description,
  c.metadata -> 'defaultExample' as default_example,
  preview.asset as default_asset,
  (
    select jsonb_build_object(
      'hash', p.card_hash, 'mimeType', 'image/webp',
      'byteLength', p.byte_size, 'width', p.width, 'height', p.height
    )
    from public.official_template_card_previews as p
    where p.source_hash = preview.asset ->> 'hash'
  ) as card_asset
from public.official_resume_template_catalog as c
left join lateral (
  select e -> 'asset' as asset
  from jsonb_array_elements(c.metadata -> 'previews') as e
  where e -> 'example' = c.metadata -> 'defaultExample'
  limit 1
) as preview on true
where c.listed;

revoke all on public.official_template_card_summaries from public, anon, authenticated;
grant select on public.official_template_card_summaries to anon, authenticated;
