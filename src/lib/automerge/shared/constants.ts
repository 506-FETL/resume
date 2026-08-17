export const AUTOMERGE_STORAGE_KEY = 'resume-automerge-v1'
export const BASE64_CHUNK_SIZE = 0x8000

export const PENDING_MESSAGE_TTL_MS = 30_000
export const PENDING_MESSAGE_LIMIT = 1000
export const PENDING_MESSAGE_FLUSH_LIMIT = 200

// 协作者通过共享 docUrl 加载文档前，等待网络适配器（Realtime 通道）就绪的超时。
// 就绪后再 repo.find(docUrl) 才有对端可同步，避免零 peer 时被立即判定 unavailable 而回退成空白文档。
export const SHARED_DOCUMENT_ADAPTER_READY_TIMEOUT_MS = 8_000
