import { MAX_FILE_BYTES, MAX_INPUT_PIXELS, type UploadedImage, type Format } from '../types'

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const unit = bytes < 1024 * 1024 ? 1024 : 1024 * 1024
  return `${(bytes / unit).toFixed(bytes / unit < 10 ? 2 : 1)} ${unit === 1024 ? 'KB' : 'MB'}`
}
export function extension(format: string) {
  if (format === 'image/svg+xml') return 'svg'
  if (format === 'application/postscript') return 'eps'
  return format === 'image/jpeg' ? 'jpg' : format.split('/')[1] || 'png'
}
export function baseName(name: string) {
  return name.replace(/\.[^.]+$/, '')
}
export function safeName(name: string) {
  return (
    name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .trim()
      .slice(0, 180) || 'image-optimized'
  )
}
export function outputName(name: string, format: Format) {
  return `${safeName(name)}.${extension(format)}`
}
export async function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.decoding = 'async'
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(
        new Error(
          'This image could not be opened. It may be damaged or use a format your browser does not support.',
        ),
      )
    img.src = url
  })
}
export async function loadFile(
  file: File,
  sample = false,
  options: { scale?: number; signal?: AbortSignal } = {},
): Promise<UploadedImage> {
  if (file.size > MAX_FILE_BYTES)
    throw new Error('This file is a little too large. Please choose an image smaller than 50 MB.')
  if (!file.size) throw new Error('This file is empty. Please choose a different image.')
  if (
    /\.(svg|eps)$/i.test(file.name) ||
    ['image/svg+xml', 'application/postscript'].includes(file.type)
  ) {
    const { loadVector } = await import('./vector')
    return loadVector(file, options)
  }
  if (
    !/\.(jpe?g|png|webp|avif|gif|bmp)$/i.test(file.name) &&
    !/^image\/(jpeg|png|webp|avif|gif|bmp|x-ms-bmp)$/.test(file.type)
  )
    throw new Error('Please choose a JPG, PNG, WebP, AVIF, GIF, BMP, SVG, or EPS image.')
  // Check the bytes as well as the filename.
  const b = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  const signature = String.fromCharCode(...b)
  let type = ''
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) type = 'image/jpeg'
  else if (b[0] === 137 && signature.slice(1, 4) === 'PNG') type = 'image/png'
  else if (signature.startsWith('GIF8')) type = 'image/gif'
  else if (signature.startsWith('BM')) type = 'image/bmp'
  else if (signature.startsWith('RIFF') && signature.slice(8, 12) === 'WEBP') type = 'image/webp'
  else if (signature.slice(4, 8) === 'ftyp' && /avif|avis/.test(signature)) type = 'image/avif'
  if (!type)
    throw new Error('This file is not a supported image. Try exporting it as JPG or PNG first.')
  const blob = file.slice(0, file.size, type)
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadHtmlImage(url)
    if (!img.naturalWidth || img.naturalWidth * img.naturalHeight > MAX_INPUT_PIXELS)
      throw new Error(
        'This image exceeds the 40-megapixel limit. Please choose a smaller version to keep your browser running smoothly.',
      )
    return {
      blob,
      url,
      width: img.naturalWidth,
      height: img.naturalHeight,
      name: file.name,
      type,
      sample,
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
export function friendlyError(error: unknown) {
  if (
    error instanceof Error &&
    (error.message.startsWith('This ') ||
      error.message.startsWith('Please ') ||
      error.message.startsWith('Your ') ||
      error.message.startsWith('Could not '))
  )
    return error.message
  return 'Your browser couldn’t finish processing this image. Try smaller dimensions or a different output format.'
}
