import { encodeCanvas, renderPixels } from '../utils/render'
import type { RenderRequest } from '../types'

self.onmessage = async (event: MessageEvent<RenderRequest>) => {
  let bitmap: ImageBitmap | undefined
  let canvas: OffscreenCanvas | undefined
  let watermarkImage: ImageBitmap | undefined
  try {
    bitmap = await createImageBitmap(event.data.blob)
    const s = event.data.settings
    canvas = new OffscreenCanvas(s.width, s.height)
    if (s.watermark.enabled && s.watermark.kind === 'image' && s.watermark.image) {
      watermarkImage = await createImageBitmap(s.watermark.image.blob)
    }
    await renderPixels(bitmap, bitmap.width, bitmap.height, canvas, s, false, watermarkImage)
    const blob = await encodeCanvas(canvas, s.format, s.quality / 100)
    self.postMessage({ blob })
  } catch {
    self.postMessage({ failed: true })
  } finally {
    bitmap?.close()
    watermarkImage?.close()
    if (canvas) {
      canvas.width = 1
      canvas.height = 1
    }
  }
}
