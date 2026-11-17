alter table public.experience_sources
  drop constraint experience_sources_kind_check,
  add constraint experience_sources_kind_check
    check (kind in ('pdf', 'docx', 'text', 'markdown', 'paste', 'image', 'spreadsheet', 'file'));

alter table public.experience_source_versions
  drop constraint experience_source_versions_source_kind_check,
  drop constraint experience_source_versions_content_check,
  drop constraint experience_source_versions_file_size_check,
  add constraint experience_source_versions_source_kind_check
    check (source_kind in ('pdf', 'docx', 'text', 'markdown', 'paste', 'image', 'spreadsheet', 'file')),
  add constraint experience_source_versions_content_check check (
    (source_kind in ('image', 'file') and extracted_text = '' and text_length = 0 and block_count = 0 and object_key is not null)
    or
    (source_kind not in ('image', 'file') and length(extracted_text) between 1 and 60000 and block_count between 1 and 30000)
  ),
  add constraint experience_source_versions_file_size_check check (
    file_size between case when source_kind = 'file' then 0 else 1 end and 10485760
  ),
  add constraint experience_source_versions_file_original_check check (
    source_kind <> 'file' or (file_name is not null and file_size is not null)
  );

update storage.buckets
set public = false, file_size_limit = 10485760, allowed_mime_types = null
where id = 'experience-source-originals';
