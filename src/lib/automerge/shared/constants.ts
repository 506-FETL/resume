export const AUTOMERGE_STORAGE_KEY = 'resume-automerge-v1'
export const BASE64_CHUNK_SIZE = 0x8000

export const PENDING_MESSAGE_TTL_MS = 30_000
export const PENDING_MESSAGE_LIMIT = 1000
export const PENDING_MESSAGE_FLUSH_LIMIT = 200

// 协作者通过共享 docUrl 加载文档前，等待网络适配器出现对端候选（host presence join）的超时。
// 有对端后再 repo.find(docUrl)，automerge 才不会因零 peer 立即判定文档 unavailable。
export const SHARED_DOCUMENT_PEER_WAIT_TIMEOUT_MS = 10_000
