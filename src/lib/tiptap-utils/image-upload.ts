import supabase from '../supabase/client'
import { getCurrentUser } from '../supabase/user'

export const MAX_FILE_SIZE = 2 * 1024 * 1024

/**
 * Helper to check if operation was aborted and throw if so
 */
export function checkAborted(abortSignal?: AbortSignal) {
  if (abortSignal?.aborted) {
    throw new DOMException('Upload aborted', 'AbortError')
  }
}

/**
 * Handles image upload with progress tracking and abort capability
 * @param file The file to upload
 * @param onProgress Optional callback for tracking upload progress
 * @param abortSignal Optional AbortSignal for cancelling the upload
 * @returns Promise resolving to the URL of the uploaded image
 */
export async function handleImageUpload(
  file: File,
  onProgress?: (event: { progress: number }) => void,
  abortSignal?: AbortSignal,
): Promise<string> {
  // Check if already aborted before starting
  checkAborted(abortSignal)

  // Validate file
  if (!file) {
    throw new Error('No file provided')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds maximum allowed (${MAX_FILE_SIZE / (1024 * 1024)}MB)`,
    )
  }

  onProgress?.({ progress: 5 })

  // Step 1: Get current user (5% -> 10%)
  checkAborted(abortSignal)

  const user = await getCurrentUser()

  if (!user) throw new Error('未登陆用户')

  onProgress?.({ progress: 10 })

  // Step 2: Upload file to storage (10% -> 70%)
  // Using XMLHttpRequest for real progress tracking
  checkAborted(abortSignal)

  const path = `${user.id}/${Date.now()}-${file.name}`

  await uploadWithProgress(
    file,
    path,
    (uploadProgress) => {
      // Map upload progress (0-100) to our range (10-70)
      const mappedProgress = 10 + uploadProgress * 0.6

      onProgress?.({ progress: Math.round(mappedProgress) })
    },
    abortSignal,
  )

  onProgress?.({ progress: 70 })

  // Step 3: Get public URL (70% -> 80%)
  checkAborted(abortSignal)

  const { data } = supabase.storage.from('avatar').getPublicUrl(path)
  const avatarUrl = data.publicUrl

  onProgress?.({ progress: 80 })

  // Step 4: Update user profile (80% -> 95%)
  checkAborted(abortSignal)

  const { error } = await supabase.auth.updateUser({
    data: { avatar_url: avatarUrl },
  })

  if (error) throw error

  onProgress?.({ progress: 95 })

  // Complete
  onProgress?.({ progress: 100 })

  return avatarUrl
}

/**
 * Upload file with real progress tracking using XMLHttpRequest
 */
export async function uploadWithProgress(
  file: File,
  path: string,
  onProgress: (progress: number) => void,
  abortSignal?: AbortSignal,
): Promise<string> {
  // Get auth token first (before creating XHR)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const uploadEndpoint = `${supabaseUrl}/storage/v1/object/avatar/${path}`

  // Get the session token for authenticated upload
  let authToken: string

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.access_token) {
      authToken = session.access_token
    } else {
      throw new Error('No valid session')
    }
  } catch {
    throw new Error('Authentication required for upload')
  }

  // Check abort before starting XHR
  if (abortSignal?.aborted) {
    throw new DOMException('Upload aborted', 'AbortError')
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    // Handle abort signal
    const abortHandler = () => {
      xhr.abort()
      reject(new DOMException('上传已取消', 'AbortError'))
    }

    if (abortSignal) {
      abortSignal.addEventListener('abort', abortHandler)
    }

    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100

        onProgress(progress)
      }
    })

    xhr.addEventListener('load', () => {
      abortSignal?.removeEventListener('abort', abortHandler)

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(path)
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText)

          reject(
            new Error(errorData.message || `上传失败，状态码 ${xhr.status}`),
          )
        } catch {
          reject(new Error(`上传失败，状态码 ${xhr.status}`))
        }
      }
    })

    xhr.addEventListener('error', () => {
      abortSignal?.removeEventListener('abort', abortHandler)
      reject(new Error('上传过程中发生网络错误'))
    })

    xhr.addEventListener('abort', () => {
      abortSignal?.removeEventListener('abort', abortHandler)
      reject(new DOMException('上传已取消', 'AbortError'))
    })

    // Open connection and set headers
    xhr.open('POST', uploadEndpoint)
    xhr.setRequestHeader('Authorization', `Bearer ${authToken}`)
    xhr.setRequestHeader('x-upsert', 'true')

    // Send the file
    xhr.send(file)
  })
}
