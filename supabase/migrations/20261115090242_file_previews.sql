alter table public.experience_sources
  drop constraint experience_sources_kind_check,
  add constraint experience_sources_kind_check
    check (kind in ('pdf', 'docx', 'text', 'markdown', 'paste', 'image', 'spreadsheet'));

alter table public.experience_source_versions
  drop constraint experience_source_versions_source_kind_check,
  drop constraint experience_source_versions_extracted_text_check,
  drop constraint experience_source_versions_block_count_check,
  add constraint experience_source_versions_source_kind_check
    check (source_kind in ('pdf', 'docx', 'text', 'markdown', 'paste', 'image', 'spreadsheet')),
  add constraint experience_source_versions_content_check check (
      (source_kind = 'image' and extracted_text = '' and text_length = 0 and block_count = 0 and object_key is not null)
      or
      (source_kind <> 'image' and length(extracted_text) between 1 and 60000 and block_count between 1 and 30000)
  );
