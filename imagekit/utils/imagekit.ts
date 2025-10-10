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
}

export interface ImageKitAuthenticationParameters {
  signature: string
  expire: number
  token: string
}

export type ImageKitFile = Record<string, unknown>

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
  return 'Unknown ImageKit error'
}

class ImageKitService {
  private readonly client: ImageKit | null

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
    folder = 'email-templates',
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
        tags: ['email-template', 'user-upload'],
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

  async listFiles(options: ImageKitListOptions = {}): Promise<ImageKitServiceResponse<ImageKitFile[]>> {
    if (!this.client) {
      return {
        success: false,
        error: 'ImageKit service is not configured',
      }
    }

    try {
      const files = await this.client.listFiles({
        skip: options.skip ?? 0,
        limit: options.limit ?? 20,
        searchQuery: options.searchQuery ?? '',
        path: options.path ?? '',
        tags: options.tags ?? [],
      })

      return {
        success: true,
        data: files as ImageKitFile[],
      }
    } catch (error) {
      console.error('ImageKit list files error:', error)
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
}

const imageKitConfig = resolveImageKitConfig()

export const imageKitService = new ImageKitService(imageKitConfig)
export default imageKitService
