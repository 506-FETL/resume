-- 精确版本外键查询的覆盖索引，与列表筛选／排序索引分开维护。
create index official_template_catalog_version
  on public.official_resume_template_catalog(template_id, current_version);
