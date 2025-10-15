import ImageKit from 'imagekit'

type UploadableFile = string | Buffer | NodeJS.ReadableStream

interface ImageKitClientConfig {
  publicKey: string
  privateKey: string
  urlEndpoint: string
}

export interface ImageKitUploadResult {
  fileId: string
  name: string
  url: string
  thumbnailUrl?: string
  filePath: string
  size: number
  fileType?: string
  width?: number
  height?: number
}

export interface ImageKitTransformations {
  width?: number
  w?: number
  height?: number
  h?: number
  quality?: number
  q?: number
  format?: string
  f?: string
  crop?: string
  c?: string
  focus?: string
  fo?: string
  blur?: number
  bl?: number
  radius?: number | string
  r?: number | string
  border?: string
  b?: string
  rotation?: number
  rt?: number
  background?: string
  bg?: string
  dpr?: number | string
  progressive?: boolean | string
  pr?: boolean | string
  lossless?: boolean | string
  lo?: boolean | string
}

export interface ImageKitListOptions {
  skip?: number
  limit?: number
  searchQuery?: string
  path?: string
  tags?: string[]
  sort?: string
}

export interface ImageKitAuthenticationParameters {
  signature: string
  expire: number
  token: string
}

export interface ImageKitFile {
  fileId?: string
  filePath?: string
  name?: string
  url?: string
  thumbnailUrl?: string
  createdAt?: string
  tags?: string[]
  [key: string]: unknown
}

export interface ImageKitFileListResult {
  files: ImageKitFile[]
  total: number
}

export type ImageKitServiceResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string }

type ImageKitTransformation = Record<string, string | number | boolean>

function resolveImageKitConfig(): ImageKitClientConfig | null {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT

  if (!publicKey || !privateKey || !urlEndpoint) {
    return null
  }

  return {
    publicKey,
    privateKey,
    urlEndpoint,
  }
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (typeof error === 'object' && error !== null) {
    const candidate =
      (error as Record<string, unknown>).message ??
      (error as Record<string, unknown>).msg ??
      (error as Record<string, unknown>).error

    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate
    }

    const response = (error as Record<string, any>).response
    const responseMessage =
      response?.body?.message ??
      response?.body?.error ??
      response?.message ??
      response?.statusText

    if (typeof responseMessage === 'string' && responseMessage.trim().length > 0) {
      return responseMessage
    }
  }
  return 'Unknown ImageKit error'
}

class ImageKitService {
  private readonly client: ImageKit | null
  private static readonly FALLBACK_SEARCH_LIMIT = 50

  constructor(config: ImageKitClientConfig | null) {
    if (!config) {
      console.warn('⚠️ ImageKit configuration missing - ImageKit features will be disabled')
      this.client = null
      return
    }

    console.log('ImageKit config loaded:', {
      publicKey: config.publicKey ? '✓' : '✗',
      privateKey: config.privateKey ? '✓' : '✗',
      urlEndpoint: config.urlEndpoint ? '✓' : '✗',
    })

    this.client = new ImageKit({
      publicKey: config.publicKey,
      privateKey: config.privateKey,
      urlEndpoint: config.urlEndpoint,
    })
  }

  async uploadFile(
    file: UploadableFile,
    fileName: string,
    folder = 'bucket',
  ): Promise<ImageKitServiceResponse<ImageKitUploadResult>> {
    if (!this.client) {
      return {
        success: false,
        error: 'ImageKit service is not configured',
      }
    }

    try {
      const uploadResponse = await this.client.upload({
        file,
        fileName,
        folder,
        useUniqueFileName: true,
        tags: ['user-upload'],
      })

      const payload: ImageKitUploadResult = {
        fileId: uploadResponse.fileId,
        name: uploadResponse.name,
        url: uploadResponse.url,
        thumbnailUrl: uploadResponse.thumbnailUrl,
        filePath: uploadResponse.filePath,
        size: uploadResponse.size,
        fileType: uploadResponse.fileType,
        width: uploadResponse.width,
        height: uploadResponse.height,
      }

      return {
        success: true,
        data: payload,
      }
    } catch (error) {
      console.error('ImageKit upload error:', error)
      return {
        success: false,
        error: extractErrorMessage(error),
      }
    }
  }

  generateUrl(filePath: string, transformations: ImageKitTransformations = {}): ImageKitServiceResponse<string> {
    if (!this.client) {
      return {
        success: false,
        error: 'ImageKit service is not configured',
      }
    }

    try {
      const url = this.client.url({
        path: filePath,
        transformation: this.buildTransformations(transformations),
      })

      return {
        success: true,
        data: url,
      }
    } catch (error) {
      console.error('ImageKit URL generation error:', error)
      return {
        success: false,
        error: extractErrorMessage(error),
      }
    }
  }

  buildTransformations(params: ImageKitTransformations): ImageKitTransformation[] {
    if (!params || typeof params !== 'object') {
      return []
    }

    const transformations: ImageKitTransformation[] = []

    if (params.width || params.w) {
      transformations.push({
        width: params.width ?? params.w ?? 0,
      })
    }

    if (params.height || params.h) {
      transformations.push({
        height: params.height ?? params.h ?? 0,
      })
    }

    if (params.quality || params.q) {
      transformations.push({
        quality: params.quality ?? params.q ?? 0,
      })
    }

    if (params.format || params.f) {
      transformations.push({
        format: params.format ?? params.f ?? '',
      })
    }

    if (params.crop || params.c) {
      transformations.push({
        cropMode: params.crop ?? params.c ?? '',
      })
    }

    if (params.focus || params.fo) {
      transformations.push({
        focus: params.focus ?? params.fo ?? '',
      })
    }

    if (params.blur || params.bl) {
      transformations.push({
        blur: params.blur ?? params.bl ?? 0,
      })
    }

    if (params.radius || params.r) {
      transformations.push({
        radius: params.radius ?? params.r ?? 0,
      })
    }

    if (params.border || params.b) {
      transformations.push({
        border: params.border ?? params.b ?? '',
      })
    }

    if (params.rotation || params.rt) {
      transformations.push({
        rotation: params.rotation ?? params.rt ?? 0,
      })
    }

    if (params.background || params.bg) {
      transformations.push({
        background: params.background ?? params.bg ?? '',
      })
    }

    if (params.dpr) {
      transformations.push({
        dpr: params.dpr,
      })
    }

    if (params.progressive || params.pr) {
      transformations.push({
        progressive: params.progressive ?? params.pr ?? false,
      })
    }

    if (params.lossless || params.lo) {
      transformations.push({
        lossless: params.lossless ?? params.lo ?? false,
      })
    }

    return transformations
  }

  async getFileDetails(fileId: string): Promise<ImageKitServiceResponse<ImageKitFile>> {
    if (!this.client) {
      return {
        success: false,
        error: 'ImageKit service is not configured',
      }
    }

    try {
      const fileDetails = await this.client.getFileDetails(fileId)
      return {
        success: true,
        data: fileDetails as ImageKitFile,
      }
    } catch (error) {
      console.error('ImageKit get file details error:', error)
      return {
        success: false,
        error: extractErrorMessage(error),
      }
    }
  }

  async deleteFile(fileId: string): Promise<ImageKitServiceResponse<void>> {
    if (!this.client) {
      return {
        success: false,
        error: 'ImageKit service is not configured',
      }
    }

    try {
      await this.client.deleteFile(fileId)
      return {
        success: true,
        data: undefined,
      }
    } catch (error) {
      console.error('ImageKit delete file error:', error)
      return {
        success: false,
        error: extractErrorMessage(error),
      }
    }
  }

  async listFiles(options: ImageKitListOptions = {}): Promise<ImageKitServiceResponse<ImageKitFileListResult>> {
    if (!this.client) {
      return {
        success: false,
        error: 'ImageKit service is not configured',
      }
    }

    const rawSearch = typeof options.searchQuery === 'string' ? options.searchQuery.trim() : ''
    const searchQuery = this.buildSearchQuery(rawSearch)
    const keywords = rawSearch ? this.tokenizeKeywords(rawSearch) : []
    const limit = options.limit ?? 20
    const effectiveLimit = rawSearch ? Math.max(limit, ImageKitService.FALLBACK_SEARCH_LIMIT) : limit

    const baseOptions = {
      skip: options.skip ?? 0,
      limit: effectiveLimit,
      path: options.path ?? '',
      tags: options.tags ?? [],
      sort: options.sort ?? 'DESC_CREATED',
    }

    try {
      const files = await this.client.listFiles({
        ...baseOptions,
        searchQuery: searchQuery ?? undefined,
      })

      let data = files as ImageKitFile[]
      const total = this.extractTotalCount(files, data.length)

      if (keywords.length) {
        data = this.filterFilesByKeywords(data, keywords)
      }

      return {
        success: true,
        data: {
          files: data.slice(0, limit),
          total,
        },
      }
    } catch (error) {
      console.error('ImageKit list files error:', error)

      if (rawSearch) {
        try {
          const fallbackFiles = await this.client.listFiles(baseOptions)
          const filtered = this.filterFilesByKeywords(fallbackFiles as ImageKitFile[], keywords)
          const total = keywords.length ? filtered.length : this.extractTotalCount(fallbackFiles, filtered.length)
          return {
            success: true,
            data: {
              files: filtered.slice(0, limit),
              total,
            },
          }
        } catch (fallbackError) {
          console.error('ImageKit fallback list files error:', fallbackError)
          return {
            success: false,
            error: extractErrorMessage(fallbackError),
          }
        }
      }

      return {
        success: false,
        error: extractErrorMessage(error),
      }
    }
  }

  getAuthenticationParameters(): ImageKitServiceResponse<ImageKitAuthenticationParameters> {
    if (!this.client) {
      return {
        success: false,
        error: 'ImageKit service is not configured',
      }
    }

    try {
      const authenticationParameters = this.client.getAuthenticationParameters() as ImageKitAuthenticationParameters
      return {
        success: true,
        data: authenticationParameters,
      }
    } catch (error) {
      console.error('ImageKit authentication error:', error)
      return {
        success: false,
        error: extractErrorMessage(error),
      }
    }
  }

  private sanitizeSearchTerm(term: string): string {
    return term.trim().replace(/\s+/g, ' ')
  }

  private isAdvancedQuery(term: string): boolean {
    return /[:\(\)\{\}\[\]"]/.test(term) || /\b(?:AND|OR|NOT)\b/i.test(term)
  }

  private escapeLucene(term: string): string {
    return term.replace(/([+\-&|!(){}\[\]^"~*?:\\\/])/g, '\\$1')
  }

  private buildSearchQuery(term: string): string | null {
    if (!term) {
      return null
    }

    if (this.isAdvancedQuery(term)) {
      return term
    }

    const sanitized = this.sanitizeSearchTerm(term)
    if (!sanitized) {
      return null
    }

    const wildcardTerm = this.escapeLucene(sanitized).replace(/\s+/g, '*')
    const escapedPhrase = this.escapeLucene(sanitized)
    return `(name:*${wildcardTerm}* OR filePath:*${wildcardTerm}* OR tags:"${escapedPhrase}")`
  }

  private tokenizeKeywords(term: string): string[] {
    return this.sanitizeSearchTerm(term)
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
  }

  private filterFilesByKeywords(files: ImageKitFile[], keywords: string[]): ImageKitFile[] {
    if (!keywords.length) {
      return files
    }

    return files.filter((file) => {
      const name = String(file.name ?? '').toLowerCase()
      const filePath = String(file.filePath ?? '').toLowerCase()
      const url = String(file.url ?? '').toLowerCase()
      const tagSource = (file as Record<string, unknown>).tags
      const tags = Array.isArray(tagSource)
        ? (tagSource as unknown[]).map((tag) => String(tag ?? '').toLowerCase())
        : []

      return keywords.every((keyword) => {
        if (!keyword) {
          return true
        }

        return (
          name.includes(keyword) ||
          filePath.includes(keyword) ||
          url.includes(keyword) ||
          tags.some((tag) => tag.includes(keyword))
        )
      })
    })
  }

  private extractTotalCount(response: any, fallback: number): number {
    const maybeMetadata = response?.$ResponseMetadata
    const headerValue =
      maybeMetadata?.headers?.['x-total-count'] ??
      maybeMetadata?.headers?.['X-Total-Count'] ??
      maybeMetadata?.headers?.['x-totalcount']

    if (typeof headerValue === 'number') {
      return headerValue
    }

    if (typeof headerValue === 'string') {
      const parsed = Number.parseInt(headerValue, 10)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }

    return fallback
  }
}

const imageKitConfig = resolveImageKitConfig()

export const imageKitService = new ImageKitService(imageKitConfig)
export default imageKitService
