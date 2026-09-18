import type { Watermark } from '../types'

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
const percent = (value: number) => Math.max(0, Math.min(100, value)) / 100

// Composite in output coordinates so the mark stays upright and scales with resize/crop.
export function drawWatermark(
  ctx: Context,
  width: number,
  height: number,
  mark: Watermark,
  image?: CanvasImageSource,
) {
  if (!mark.enabled || mark.opacity <= 0) return
  if (mark.kind === 'text' ? !mark.text.trim() : !mark.image || !image) return
  const padding = Math.min(width, height) * 0.03
  const availableWidth = width - padding * 2
  const availableHeight = height - padding * 2
  const desiredWidth = Math.min(availableWidth, width * percent(mark.size))
  if (desiredWidth <= 0) return
  ctx.save()
  try {
    ctx.globalAlpha = percent(mark.opacity)
    ctx.globalCompositeOperation = 'source-over'
    if (mark.kind === 'image' && mark.image && image) {
      const scale = Math.min(desiredWidth / mark.image.width, availableHeight / mark.image.height)
      const w = mark.image.width * scale,
        h = mark.image.height * scale
      const x = padding + (availableWidth - w) * percent(mark.x)
      const y = padding + (availableHeight - h) * percent(mark.y)
      ctx.drawImage(image, x, y, w, h)
      return
    }
    const text = mark.text.trim()
    ctx.font = '600 100px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    const metrics = ctx.measureText(text)
    const left = metrics.actualBoundingBoxLeft
    const right = metrics.actualBoundingBoxRight
    const ascent = metrics.actualBoundingBoxAscent
    const descent = metrics.actualBoundingBoxDescent
    const textWidth = Math.max(metrics.width, left + right)
    const textHeight = Math.max(1, ascent + descent)
    if (textWidth <= 0) return
    const scale = Math.min(desiredWidth / textWidth, availableHeight / textHeight)
    const x = padding + (availableWidth - textWidth * scale) * percent(mark.x)
    const y = padding + (availableHeight - textHeight * scale) * percent(mark.y)
    ctx.translate(x, y)
    ctx.scale(scale, scale)
    ctx.fillStyle = mark.color
    ctx.fillText(text, Math.max(0, left), ascent)
  } finally {
    ctx.restore()
  }
}
