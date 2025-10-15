import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type {
  ImageKitFile,
  ImageKitListOptions,
  ImageKitFileListResult,
  ImageKitTransformations,
  ImageKitUploadResult,
} from '#imagekit/utils/imagekit'

interface UploadOptions {
  folder?: string
  fileName?: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

type UploadApiResponse = ApiResponse<ImageKitUploadResult>
type UrlApiResponse = ApiResponse<string>
type ListApiResponse = ApiResponse<ImageKitFileListResult>
type DeleteApiResponse = ApiResponse<boolean>
export interface UseImageKit {
  isUploading: ComputedRef<boolean>
  uploadProgress: ComputedRef<number>
  uploadedImages: ComputedRef<ImageKitUploadResult[]>
  error: ComputedRef<string | null>
  uploadImage: (file: File, options?: UploadOptions) => Promise<ImageKitUploadResult>
  generateImageUrl: (filePath: string, transformations?: ImageKitTransformations) => Promise<string>
  getImageList: (options?: ImageKitListOptions) => Promise<ImageKitFileListResult>
  deleteImage: (fileId: string) => Promise<boolean>
  parseTransformations: (transformString?: string) => ImageKitTransformations
  buildTransformationString: (transformations: ImageKitTransformations) => string
  isValidImageFile: (file: File) => boolean
  formatFileSize: (bytes: number) => string
}

function assertSuccess<T>(result: ApiResponse<T>, fallback?: T): T {
  if (result.success) {
    if (result.data !== undefined) {
      return result.data
    }

    if (fallback !== undefined) {
      return fallback
    }
  }

  throw new Error(result.error ?? 'ImageKit request failed')
}

export function useImageKit(): UseImageKit {
  const isUploading: Ref<boolean> = ref(false)
  const uploadProgress: Ref<number> = ref(0)
  const uploadedImages: Ref<ImageKitUploadResult[]> = ref([])
  const error: Ref<string | null> = ref(null)

  const uploadImage = async (file: File, options: UploadOptions = {}): Promise<ImageKitUploadResult> => {
    isUploading.value = true
    uploadProgress.value = 0
    error.value = null

    try {
      const formData = new FormData()
      formData.append('image', file)

      if (options.folder) {
        formData.append('folder', options.folder)
      }

      if (options.fileName) {
        formData.append('fileName', options.fileName)
      }

      const response = await fetch('/api/imagekit/upload', {
        method: 'POST',
        body: formData,
      })

      const result = (await response.json()) as UploadApiResponse
      const data = assertSuccess(result)

      uploadedImages.value.push(data)
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ImageKit upload failed'
      error.value = message
      throw err instanceof Error ? err : new Error(message)
    } finally {
      isUploading.value = false
      uploadProgress.value = 0
    }
  }

  const generateImageUrl = async (
    filePath: string,
    transformations: ImageKitTransformations = {},
  ): Promise<string> => {
    try {
      const response = await fetch('/api/imagekit/generate-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath,
          transformations,
        }),
      })

      const result = (await response.json()) as UrlApiResponse
      return assertSuccess(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate ImageKit URL'
      error.value = message
      throw err instanceof Error ? err : new Error(message)
    }
  }

  const getImageList = async (options: ImageKitListOptions = {}): Promise<ImageKitFileListResult> => {
    try {
      const params = new URLSearchParams()

      if (typeof options.skip === 'number') params.append('skip', String(options.skip))
      if (typeof options.limit === 'number') params.append('limit', String(options.limit))
      if (options.searchQuery) params.append('searchQuery', options.searchQuery)
      if (options.path) params.append('path', options.path)
      if (options.tags?.length) params.append('tags', options.tags.join(','))
      if (options.sort) params.append('sort', options.sort)

      const response = await fetch(`/api/imagekit/files?${params}`)
      const result = (await response.json()) as ListApiResponse

      return assertSuccess(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list ImageKit files'
      error.value = message
      throw err instanceof Error ? err : new Error(message)
    }
  }

  const deleteImage = async (fileId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/imagekit/files/${fileId}`, {
        method: 'DELETE',
      })

      const result = (await response.json()) as DeleteApiResponse
      const success = assertSuccess(result, true)

      if (success) {
        uploadedImages.value = uploadedImages.value.filter((img) => img.fileId !== fileId)
      }

      return success
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete ImageKit file'
      error.value = message
      throw err instanceof Error ? err : new Error(message)
    }
  }

  const parseTransformations = (transformString?: string): ImageKitTransformations => {
    if (!transformString) return {}

    const transformations: ImageKitTransformations = {}
    const parts = transformString.split(',')

    parts.forEach((part) => {
      const [key, value] = part.split('-')
      if (key && value) {
        const numValue = Number(value)
        transformations[key as keyof ImageKitTransformations] = Number.isNaN(numValue) ? value : numValue
      }
    })

    return transformations
  }

  const buildTransformationString = (transformations: ImageKitTransformations): string => {
    return Object.entries(transformations)
      .map(([key, value]) => `${key}-${value}`)
      .join(',')
  }

  const isValidImageFile = (file: File): boolean => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    return allowedTypes.includes(file.type)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const formatted = Number.parseFloat((bytes / k ** i).toFixed(2))
    return `${formatted} ${sizes[i]}`
  }

  return {
    isUploading: computed(() => isUploading.value),
    uploadProgress: computed(() => uploadProgress.value),
    uploadedImages: computed(() => uploadedImages.value),
    error: computed(() => error.value),
    uploadImage,
    generateImageUrl,
    getImageList,
    deleteImage,
    parseTransformations,
    buildTransformationString,
    isValidImageFile,
    formatFileSize,
  }
}
