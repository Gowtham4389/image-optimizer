import { drawWatermark } from './watermark'
import { MAX_DIMENSION, MAX_OUTPUT_PIXELS, type RenderRequest } from '../types'

export function validateDimensions(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION ||
    width * height > MAX_OUTPUT_PIXELS
  ) {
    throw new Error(
      `Please use dimensions between 1 and ${MAX_DIMENSION} pixels, with a maximum of 24 megapixels.`,
    )
  }
}

export async function renderPixels(
  image: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  canvas: HTMLCanvasElement | OffscreenCanvas,
  settings: RenderRequest['settings'],
  yieldToBrowser = false,
  watermarkImage?: CanvasImageSource,
) {
  const s = settings
  validateDimensions(s.width, s.height)
  canvas.width = s.width
  canvas.height = s.height
  const ctx = canvas.getContext('2d', {
    willReadFrequently:
      s.brightness !== 100 || s.contrast !== 100 || s.saturation !== 100 || s.grayscale,
  }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx)
    throw new Error(
      'Your browser could not create an image canvas. Try closing other tabs or using a smaller image.',
    )
  const sideways = Math.abs(s.rotation % 180) === 90
  const rotatedWidth = sideways ? naturalHeight : naturalWidth
  const rotatedHeight = sideways ? naturalWidth : naturalHeight
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.save()
  ctx.scale(s.width / rotatedWidth, s.height / rotatedHeight)
  ctx.translate(rotatedWidth / 2, rotatedHeight / 2)
  ctx.rotate((s.rotation * Math.PI) / 180)
  ctx.scale(s.flipX ? -1 : 1, s.flipY ? -1 : 1)
  ctx.drawImage(image, -naturalWidth / 2, -naturalHeight / 2, naturalWidth, naturalHeight)
  ctx.restore()
  if (s.brightness !== 100 || s.contrast !== 100 || s.saturation !== 100 || s.grayscale) {
    // Process strips to bound memory and keep the fallback responsive. This also works in Safari without Canvas.filter.
    for (let y = 0; y < s.height; y += 128) {
      const pixels = ctx.getImageData(0, y, s.width, Math.min(128, s.height - y))
      const d = pixels.data,
        bright = s.brightness / 100,
        contrast = s.contrast / 100,
        saturation = s.grayscale ? 0 : s.saturation / 100
      for (let i = 0; i < d.length; i += 4) {
        const r = (d[i] * bright - 127.5) * contrast + 127.5
        const g = (d[i + 1] * bright - 127.5) * contrast + 127.5
        const b = (d[i + 2] * bright - 127.5) * contrast + 127.5
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
        d[i] = luminance + (r - luminance) * saturation
        d[i + 1] = luminance + (g - luminance) * saturation
        d[i + 2] = luminance + (b - luminance) * saturation
      }
      ctx.putImageData(pixels, 0, y)
      if (yieldToBrowser) await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  drawWatermark(ctx, s.width, s.height, s.watermark, watermarkImage)
  if (s.format === 'image/jpeg') {
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = s.background
    ctx.fillRect(0, 0, s.width, s.height)
    ctx.globalCompositeOperation = 'source-over'
  }
}

export async function encodeCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality: number,
): Promise<Blob> {
  if (type === 'image/avif') {
    const ctx = canvas.getContext('2d') as
      CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
    if (!ctx) throw new Error('Could not read image pixels for AVIF export.')
    const { encodeAvif } = await import('./avif')
    return encodeAvif(ctx.getImageData(0, 0, canvas.width, canvas.height), quality)
  }
  return 'convertToBlob' in canvas
    ? canvas.convertToBlob({ type, quality })
    : canvasBlob(canvas, type, quality)
}

export function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(
              new Error(
                'Your browser ran out of resources while saving. Try smaller image dimensions.',
              ),
            ),
      type,
      quality,
    ),
  )
}
