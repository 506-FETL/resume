-- 官方资源与旧私有模板分离；发布版本永久保留，目录可独立下架。
create table public.official_resume_template_versions (
  template_id text not null check (template_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(template_id) <= 80),
  version integer not null check (version > 0),
  content text not null check (octet_length(content) <= 262144),
  content_hash text not null check (content_hash = encode(sha256(convert_to(content, 'UTF8')), 'hex')),
  published_at timestamptz,
  primary key (template_id, version),
  constraint template_identity check (jsonb_typeof(content::jsonb) = 'object'
    and (content::jsonb ->> 'templateId') is not distinct from template_id
    and (content::jsonb ->> 'version')::integer is not distinct from version
    and (content::jsonb ->> 'schemaVersion')::integer is not distinct from 1)
);
create table public.official_resume_example_versions (
  example_id text not null check (example_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(example_id) <= 80),
  version integer not null check (version > 0),
  content text not null check (octet_length(content) <= 524288),
  content_hash text not null check (content_hash = encode(sha256(convert_to(content, 'UTF8')), 'hex')),
  published_at timestamptz,
  primary key (example_id, version),
  constraint example_identity check (jsonb_typeof(content::jsonb) = 'object'
    and (content::jsonb ->> 'exampleId') is not distinct from example_id
    and (content::jsonb ->> 'version')::integer is not distinct from version)
);
create table public.official_resume_template_catalog (
  template_id text primary key,
  current_version integer not null,
  sort_order integer not null default 0,
  listed boolean not null default false,
  metadata jsonb not null check (octet_length(metadata::text) <= 16384),
  style text generated always as (metadata #>> '{category,style}') stored,
  layout text generated always as (metadata #>> '{category,layout}') stored,
  foreign key (template_id, current_version) references public.official_resume_template_versions(template_id, version),
  constraint catalog_identity check (jsonb_typeof(metadata) = 'object'
    and (metadata ->> 'templateId') is not distinct from template_id
    and (metadata ->> 'currentVersion')::integer is not distinct from current_version
    and jsonb_typeof(metadata -> 'examples') is not distinct from 'array'
    and jsonb_array_length(metadata -> 'examples') > 0
    and length(metadata #>> '{category,style}') > 0
    and length(metadata #>> '{category,layout}') > 0)
);
create index official_template_catalog_order on public.official_resume_template_catalog(sort_order, template_id) where listed;
create index official_template_catalog_style on public.official_resume_template_catalog(style, sort_order, template_id) where listed;
create index official_template_catalog_layout on public.official_resume_template_catalog(layout, sort_order, template_id) where listed;

create function public.protect_official_resume_resource() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.published_at is not null then
    raise exception 'Published resume resources are immutable; publish a new version' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.protect_official_resume_resource() from public, anon, authenticated;
create trigger protect_official_template before update or delete on public.official_resume_template_versions
for each row execute function public.protect_official_resume_resource();
create trigger protect_official_example before update or delete on public.official_resume_example_versions
for each row execute function public.protect_official_resume_resource();

create function public.validate_official_resume_catalog() returns trigger
language plpgsql set search_path = '' as $$
declare item jsonb;
begin
  if not exists (select 1 from public.official_resume_template_versions where template_id = new.template_id and version = new.current_version and published_at is not null) then
    raise exception 'Catalog must reference a published template version' using errcode = '23514';
  end if;
  if not exists (select 1 from jsonb_array_elements(new.metadata -> 'examples') as e
    where e ->> 'exampleId' = new.metadata #>> '{defaultExample,exampleId}'
      and e ->> 'version' = new.metadata #>> '{defaultExample,version}') then
    raise exception 'Default example must be present in catalog examples' using errcode = '23514';
  end if;
  for item in select * from jsonb_array_elements(new.metadata -> 'examples') loop
    if not exists (select 1 from public.official_resume_example_versions where example_id = item ->> 'exampleId' and version = (item ->> 'version')::integer and published_at is not null) then
      raise exception 'Catalog must reference published example versions' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.validate_official_resume_catalog() from public, anon, authenticated;
create trigger validate_official_catalog before insert or update on public.official_resume_template_catalog
for each row execute function public.validate_official_resume_catalog();

alter table public.official_resume_template_versions enable row level security;
alter table public.official_resume_example_versions enable row level security;
alter table public.official_resume_template_catalog enable row level security;
revoke all on public.official_resume_template_versions, public.official_resume_example_versions, public.official_resume_template_catalog from public, anon, authenticated;
grant select on public.official_resume_template_versions, public.official_resume_example_versions, public.official_resume_template_catalog to anon, authenticated;
grant all on public.official_resume_template_versions, public.official_resume_example_versions, public.official_resume_template_catalog to service_role;
create policy "Read published official templates" on public.official_resume_template_versions for select to anon, authenticated using (published_at is not null);
create policy "Read published official examples" on public.official_resume_example_versions for select to anon, authenticated using (published_at is not null);
create policy "Read listed official catalog" on public.official_resume_template_catalog for select to anon, authenticated using (listed);

create function public.official_resume_template_facets() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'styles', coalesce(jsonb_agg(distinct style order by style) filter (where style is not null), '[]'::jsonb),
    'layouts', coalesce(jsonb_agg(distinct layout order by layout) filter (where layout is not null), '[]'::jsonb)
  ) from public.official_resume_template_catalog where listed;
$$;
revoke all on function public.official_resume_template_facets() from public;
grant execute on function public.official_resume_template_facets() to anon, authenticated, service_role;
-- 精确迁移既有配置；发布内容和哈希不可原地覆盖。
insert into public.official_resume_example_versions (example_id, version, content, content_hash, published_at) values ('graduate', 1, '{"exampleId":"graduate","version":1,"name":"应届求职","projectionReferenceDate":"2026-10-21","content":{"basics":{"name":"陈知远","gender":"不填","birthMonth":"","phone":"13800000000","email":"graduate@example.com","workYears":"应届","maritalStatus":"不填","heightCm":0,"weightKg":0,"nation":"","nativePlace":"杭州","politicalStatus":"不填","customFields":[]},"job_intent":{"jobIntent":"前端开发工程师","intentionalCity":"杭州 / 上海","expectedSalary":12,"dateEntry":"随时到岗"},"application_info":{"applicationSchool":"","applicationMajor":""},"edu_background":{"items":[{"entryId":"graduate-education-1","schoolName":"明川大学（示例）","professional":"计算机科学与技术","degree":"本科","duration":["2022-09","2026-06"],"eduInfo":"<p>GPA 3.7/4.0，专业排名前 10%。主修数据结构、计算机网络、软件工程与数据库。</p><p>获得校级奖学金，参与校园信息系统的设计与开发。</p>"}]},"work_experience":{"items":[{"entryId":"default_work_experience_1","hidden":false,"companyName":"","position":"","workDuration":["",""],"workInfo":""}]},"internship_experience":{"items":[{"entryId":"graduate-internship-1","companyName":"青禾信息科技（示例）","position":"前端开发实习生","internshipDuration":["2025-07","2025-12"],"internshipInfo":"<ul><li>参与内部管理系统开发，使用 React 和 TypeScript 完成列表筛选、表单校验与详情页面。</li><li>与设计和后端同学对齐接口及交互，修复移动端布局问题，整理通用表单组件。</li><li>为核心操作补充错误提示和加载反馈，协助完成上线前的功能验收。</li></ul>"}]},"campus_experience":{"items":[{"entryId":"graduate-campus-1","experienceName":"计算机协会","role":"技术组成员","duration":["2023-09","2025-06"],"campusInfo":"<ul><li>组织前端学习交流与代码分享，协助新成员完成入门项目。</li><li>参与维护社团网站，负责活动信息发布与页面适配。</li></ul>"}]},"project_experience":{"items":[{"entryId":"graduate-project-1","projectName":"校园活动报名平台","participantRole":"前端负责人","projectDuration":["2025-03","2025-06"],"projectInfo":"<ul><li>完成活动列表、报名表单和个人报名记录，设计页面路由与状态管理。</li><li>通过请求缓存和分页加载减少重复请求，优化弱网情况下的使用体验。</li><li>与两名同学协作完成接口联调、测试和项目文档，形成可复用的开发约定。</li></ul>"}]},"skill_specialty":{"description":"<p>掌握 HTML、CSS、JavaScript 基础，熟悉组件开发、接口联调与 Git 协作。</p>","skills":[{"entryId":"graduate-skill-1","label":"React / TypeScript","proficiencyLevel":"熟练","displayType":"text"},{"entryId":"graduate-skill-2","label":"Git","proficiencyLevel":"良好","displayType":"text"}]},"honors_certificates":{"description":"","certificates":[{"entryId":"graduate-honor-1","name":"大学英语六级"},{"entryId":"graduate-honor-2","name":"校级奖学金"}]},"self_evaluation":{"content":"<p>重视代码可读性与用户体验，能够主动拆解问题、沟通进度并持续迭代。希望在实际产品中积累工程经验，与团队共同完成可靠的交付。</p>"},"hobbies":{"description":"","hobbies":[{"entryId":"graduate-hobby-1","name":"阅读"},{"entryId":"graduate-hobby-2","name":"跑步"}]},"order":["basics","job_intent","application_info","edu_background","work_experience","internship_experience","campus_experience","project_experience","skill_specialty","honors_certificates","self_evaluation","hobbies"],"visibility":{"job_intent":false,"application_info":true,"edu_background":false,"work_experience":true,"internship_experience":false,"campus_experience":false,"project_experience":false,"skill_specialty":false,"honors_certificates":false,"self_evaluation":false,"hobbies":true}}}', 'bc4f5b333478fe28ba51b103b24c3906a3ed589b808d6b8f66d58eb529960722', now());
insert into public.official_resume_example_versions (example_id, version, content, content_hash, published_at) values ('frontend', 1, '{"exampleId":"frontend","version":1,"name":"前端工程师社招","projectionReferenceDate":"2026-10-21","content":{"basics":{"name":"林知夏","gender":"不填","birthMonth":"","phone":"13800000000","email":"frontend@example.com","workYears":"3-5年","maritalStatus":"不填","heightCm":0,"weightKg":0,"nation":"","nativePlace":"上海","politicalStatus":"不填","customFields":[]},"job_intent":{"jobIntent":"前端开发工程师","intentionalCity":"上海 / 杭州","expectedSalary":25,"dateEntry":"1个月内"},"application_info":{"applicationSchool":"","applicationMajor":""},"edu_background":{"items":[{"entryId":"frontend-education-1","schoolName":"明川大学（示例）","professional":"软件工程","degree":"本科","duration":["2017-09","2021-06"],"eduInfo":"<p>主修软件工程、数据结构、计算机网络和数据库，毕业设计为团队任务管理系统。</p>"}]},"work_experience":{"items":[{"entryId":"frontend-work-1","companyName":"青禾信息科技（示例）","position":"前端开发工程师","workDuration":["2023-03","至今"],"workInfo":"<ul><li>负责企业协同产品的前端开发，使用 React、TypeScript 与组件库交付核心业务页面。</li><li>梳理复杂表单的状态边界，统一请求与错误处理，降低重复实现和维护成本。</li><li>优化首屏资源加载与长列表渲染，通过性能指标和实际回访验证改进效果。</li><li>参与需求评审、代码审查及发布验收，维护开发文档并支持新成员入职。</li></ul>"},{"entryId":"frontend-work-2","companyName":"映山数字科技（示例）","position":"前端开发工程师","workDuration":["2021-07","2023-02"],"workInfo":"<ul><li>开发运营管理后台与移动端活动页面，完成权限展示、数据报表和表单流程。</li><li>抽取通用列表、筛选器与弹窗组件，与设计团队保持视觉和交互一致。</li><li>维护项目构建配置，参与线上问题排查与回归验证。</li></ul>"}]},"internship_experience":{"items":[{"entryId":"default_internship_experience_1","hidden":false,"companyName":"","position":"","internshipDuration":["",""],"internshipInfo":""}]},"campus_experience":{"items":[{"entryId":"default_campus_experience_1","hidden":false,"experienceName":"","role":"","duration":["",""],"campusInfo":""}]},"project_experience":{"items":[{"entryId":"frontend-project-1","projectName":"团队协作管理平台","participantRole":"前端核心开发","projectDuration":["2024-02","2024-10"],"projectInfo":"<ul><li>实现任务列表、详情编辑与成员协作，建立页面状态和服务端数据的清晰边界。</li><li>针对重复提交、请求乱序和网络失败设计恢复机制，保持编辑内容稳定。</li><li>沉淀可复用组件与排查文档，为迭代和跨团队接入提供支持。</li></ul>"}]},"skill_specialty":{"description":"<p>熟悉现代前端工程体系，关注可访问性、性能及复杂状态管理。能够独立推进需求拆解、开发联调和上线验收。</p>","skills":[{"entryId":"frontend-skill-1","label":"React / TypeScript","proficiencyLevel":"精通","displayType":"text"},{"entryId":"frontend-skill-2","label":"浏览器性能优化","proficiencyLevel":"熟练","displayType":"text"},{"entryId":"frontend-skill-3","label":"工程化与组件设计","proficiencyLevel":"熟练","displayType":"text"}]},"honors_certificates":{"description":"","certificates":[{"entryId":"frontend-honor-1","name":"大学英语六级"}]},"self_evaluation":{"content":"<p>注重业务理解与技术方案的可维护性，善于通过清晰的沟通和小步验证推进复杂需求。对问题保持追踪，重视协作与稳定交付。</p>"},"hobbies":{"description":"","hobbies":[{"entryId":"frontend-hobby-1","name":"摄影"}]},"order":["basics","job_intent","application_info","edu_background","work_experience","internship_experience","campus_experience","project_experience","skill_specialty","honors_certificates","self_evaluation","hobbies"],"visibility":{"job_intent":false,"application_info":true,"edu_background":false,"work_experience":false,"internship_experience":true,"campus_experience":true,"project_experience":false,"skill_specialty":false,"honors_certificates":false,"self_evaluation":false,"hobbies":true}}}', 'ef7f8675ffcab18daab3dd6e0f2cb2c626aff63138717acd74ad94521ffe6bc0', now());
insert into public.official_resume_template_versions (template_id, version, content, content_hash, published_at) values ('default', 1, '{"schemaVersion":1,"templateId":"default","version":1,"renderContract":"resume-v1","layout":{"component":"single-column@1","sectionOrder":"resume","sectionVisibility":"resume"},"header":{"component":"centered-profile@1","fieldBinding":"profile-with-job-intent@1"},"sectionHeading":{"component":"underline-heading@1"},"contentByKind":{"experience":{"component":"plain-entry-list@1","metaLayout":"title-subtitle-inline-date-right"},"richText":{"component":"plain-rich-text@1"},"skills":{"component":"skill-badges@1"},"fieldList":{"component":"inline-fields@1","presentation":"outlined-tags"},"tagList":{"component":"tag-list@1"}},"appearanceDefaults":{"theme":{"theme":"default"},"font":{"fontFamily":"noto-sans-sc","fontSize":14},"spacing":{"sectionSpacing":20,"lineHeight":1.6,"pageMargin":16}}}', '79b447ffe69a9c3a4e77c1f068d047a19e8b0f910cb865d1f9c965dcc026e23d', now());
insert into public.official_resume_template_catalog (template_id, current_version, sort_order, listed, metadata) values ('default', 1, 0, true, '{"templateId":"default","name":"默认模板","description":"清晰的单栏排版，适合展示教育、工作与项目经历。","currentVersion":1,"category":{"style":"简约","layout":"单栏"},"defaultExample":{"exampleId":"graduate","version":1},"examples":[{"exampleId":"graduate","version":1,"name":"应届生示例","description":"突出教育、实习与校园经历"},{"exampleId":"frontend","version":1,"name":"前端开发示例","description":"突出工作、项目与专业技能"}]}'::jsonb);
insert into public.official_resume_template_versions (template_id, version, content, content_hash, published_at) values ('classic-ribbon', 1, '{"schemaVersion":1,"templateId":"classic-ribbon","version":1,"renderContract":"resume-v1","layout":{"component":"ruled-column@1","sectionOrder":"resume","sectionVisibility":"resume"},"header":{"component":"banner-profile@1","fieldBinding":"profile-with-job-intent@1"},"sectionHeading":{"component":"ribbon-heading@1"},"contentByKind":{"experience":{"component":"aligned-entry-list@1","metaLayout":"date-title-subtitle-columns"},"richText":{"component":"plain-rich-text@1"},"skills":{"component":"skill-meters@1"},"fieldList":{"component":"inline-fields@1","presentation":"outlined-tags"},"tagList":{"component":"tag-list@1"}},"palette":{"primary":"#4f7483","accent":"#c1a065"},"appearanceDefaults":{"theme":{"theme":"default"},"font":{"fontFamily":"noto-sans-sc","fontSize":15},"spacing":{"sectionSpacing":16,"lineHeight":1.6,"pageMargin":24}}}', '68b4e0a70e6d6b48a99aba913753a511340d0b0f8edff726b0970d8aed3a118b', now());
insert into public.official_resume_template_catalog (template_id, current_version, sort_order, listed, metadata) values ('classic-ribbon', 1, 1, true, '{"templateId":"classic-ribbon","name":"经典蓝金模板","description":"蓝金配色搭配斜角标题，基本信息与经历分列呈现，清晰展示职业履历。","currentVersion":1,"category":{"style":"经典","layout":"单栏"},"defaultExample":{"exampleId":"frontend","version":1},"examples":[{"exampleId":"graduate","version":1,"name":"应届生示例","description":"突出教育、实习与校园经历"},{"exampleId":"frontend","version":1,"name":"前端开发示例","description":"突出工作、项目与专业技能"}]}'::jsonb);
