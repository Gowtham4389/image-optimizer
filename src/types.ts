export type Format = 'image/webp' | 'image/jpeg' | 'image/png' | 'image/avif'
export type Tab = 'crop' | 'resize' | 'optimize' | 'convert' | 'adjust' | 'watermark'
export interface SourceImage {
  blob: Blob
  url: string
  width: number
  height: number
}
export interface UploadedImage extends SourceImage {
  name: string
  type: string
  sample?: boolean
  originalSize?: number
  vectorScale?: number
}
export interface WatermarkImage {
  blob: Blob
  name: string
  width: number
  height: number
}
export interface Watermark {
  enabled: boolean
  kind: 'text' | 'image'
  text: string
  color: string
  opacity: number
  size: number
  x: number
  y: number
  image: WatermarkImage | null
}
export interface Settings {
  source: SourceImage
  width: number
  height: number
  locked: boolean
  format: Format
  quality: number
  background: string
  rotation: number
  flipX: boolean
  flipY: boolean
  brightness: number
  contrast: number
  saturation: number
  grayscale: boolean
  removeMetadata: boolean
  watermark: Watermark
}
export type RenderSettings = Omit<Settings, 'source' | 'locked' | 'removeMetadata'>
export interface RenderRequest {
  blob: Blob
  settings: RenderSettings
}
export interface Output {
  blob: Blob
  url: string
  width: number
  height: number
}
export const FORMATS: { value: Format; label: string; description: string }[] = [
  {
    value: 'image/webp',
    label: 'WebP',
    description: 'Small files. Beautiful quality. Great for the web.',
  },
  {
    value: 'image/jpeg',
    label: 'JPG',
    description: 'A familiar format for photos. Uses a solid background.',
  },
  {
    value: 'image/png',
    label: 'PNG',
    description: 'Lossless encoding with full transparency support.',
  },
  {
    value: 'image/avif',
    label: 'AVIF',
    description: 'Next-generation compression, when your browser supports it.',
  },
]
export const ACCEPT =
  '.jpg,.jpeg,.png,.webp,.avif,.gif,.bmp,.svg,.eps,image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,image/svg+xml,application/postscript'
export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const MAX_INPUT_PIXELS = 40_000_000
export const MAX_OUTPUT_PIXELS = 24_000_000
export const MAX_DIMENSION = 8192
