import type {
  ResolvedShareVersionSource,
  ResumeShareVersionSourceColumns,
  ShareVersionSource,
} from './share.types'

export function readShareVersionSource(
  row: ResumeShareVersionSourceColumns,
): ShareVersionSource {
  if (
    row.source_kind !== 'history'
    || row.source_version_no == null
    || !row.source_version_label
    || !row.source_version_created_at
  ) {
    return { kind: 'current' }
  }

  return {
    kind: 'history',
    versionId: row.source_version_id,
    versionNo: row.source_version_no,
    versionLabel: row.source_version_label,
    versionCreatedAt: row.source_version_created_at,
  }
}

export function toShareVersionSourcePatch(
  source: ResolvedShareVersionSource,
): ResumeShareVersionSourceColumns {
  if (source.kind === 'current') {
    return {
      source_kind: 'current',
      source_version_id: null,
      source_version_no: null,
      source_version_label: null,
      source_version_created_at: null,
    }
  }

  return {
    source_kind: 'history',
    source_version_id: source.versionId,
    source_version_no: source.versionNo,
    source_version_label: source.versionLabel,
    source_version_created_at: source.versionCreatedAt,
  }
}
