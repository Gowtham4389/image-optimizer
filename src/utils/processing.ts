import type { Format, RenderRequest, Settings, UploadedImage } from '../types'
import { loadHtmlImage } from './files'
import { canvasBlob, encodeCanvas, renderPixels, validateDimensions } from './render'
import { preserveExif } from './metadata'

export function initialSettings(source: UploadedImage, formats: Format[]): Settings {
  const scale = Math.min(
    1,
    8192 / source.width,
    8192 / source.height,
    Math.sqrt(24_000_000 / (source.width * source.height)),
  )
  return {
    source,
    width: Math.max(1, Math.floor(source.width * scale)),
    height: Math.max(1, Math.floor(source.height * scale)),
    locked: true,
    format: formats.includes('image/webp')
      ? 'image/webp'
      : source.type === 'image/jpeg'
        ? 'image/jpeg'
        : 'image/png',
    quality: 90,
    background: '#ffffff',
    rotation: 0,
    flipX: false,
    flipY: false,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    grayscale: false,
    removeMetadata: true,
    watermark: {
      enabled: false,
      kind: 'text',
      text: '',
      color: '#ffffff',
      opacity: 50,
      size: 25,
      x: 100,
      y: 100,
      image: null,
    },
  }
}
export async function detectFormats(): Promise<Format[]> {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 2
  const formats: Format[] = ['image/jpeg', 'image/png']
  if (typeof WebAssembly !== 'undefined') formats.push('image/avif')
  for (const format of ['image/webp'] as Format[]) {
    try {
      const blob = await canvasBlob(canvas, format, 0.9)
      if (blob.type === format) formats.push(format)
    } catch {
      /* Browser encoder unavailable. */
    }
  }
  canvas.width = 1
  canvas.height = 1
  return formats
}
function abortError() {
  return new DOMException('Aborted', 'AbortError')
}
async function workerRender(request: RenderRequest, signal?: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/image.worker.ts', import.meta.url), {
      type: 'module',
    })
    const clean = () => {
      worker.terminate()
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
    const abort = () => {
      clean()
      reject(abortError())
    }
    const timer = setTimeout(() => {
      clean()
      reject(new Error('Worker timeout'))
    }, 60_000)
    signal?.addEventListener('abort', abort, { once: true })
    worker.onmessage = (e) => {
      clean()
      if (e.data.blob) resolve(e.data.blob)
      else reject(new Error('Worker unavailable'))
    }
    worker.onerror = () => {
      clean()
      reject(new Error('Worker unavailable'))
    }
    worker.postMessage(request)
  })
}
export async function processImage(
  settings: Settings,
  original?: UploadedImage,
  signal?: AbortSignal,
): Promise<Blob> {
  validateDimensions(settings.width, settings.height)
  if (signal?.aborted) throw abortError()
  const { source, ...rest } = settings
  const request = { blob: source.blob, settings: rest }
  let blob: Blob | undefined
  if (
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap !== 'undefined' &&
    typeof Worker !== 'undefined'
  ) {
    try {
      blob = await workerRender(request, signal)
    } catch (error) {
      if (signal?.aborted) throw error
    }
  }
  if (!blob) {
    const img = await loadHtmlImage(source.url)
    const canvas = document.createElement('canvas')
    let watermarkUrl = ''
    try {
      if (signal?.aborted) throw abortError()
      let watermarkImage: HTMLImageElement | undefined
      if (
        settings.watermark.enabled &&
        settings.watermark.kind === 'image' &&
        settings.watermark.image
      ) {
        watermarkUrl = URL.createObjectURL(settings.watermark.image.blob)
        watermarkImage = await loadHtmlImage(watermarkUrl)
      }
      await renderPixels(
        img,
        img.naturalWidth,
        img.naturalHeight,
        canvas,
        settings,
        true,
        watermarkImage,
      )
      blob = await encodeCanvas(canvas, settings.format, settings.quality / 100)
    } finally {
      if (watermarkUrl) URL.revokeObjectURL(watermarkUrl)
      canvas.width = 1
      canvas.height = 1
    }
  }
  if (signal?.aborted) throw abortError()
  if (blob.type !== settings.format)
    throw new Error(
      'Your browser does not support this export format. Please choose PNG or JPG instead.',
    )
  if (
    !settings.removeMetadata &&
    original?.type === 'image/jpeg' &&
    settings.format === 'image/jpeg'
  )
    blob = await preserveExif(original.blob, blob, settings.width, settings.height)
  return blob
}
