import { MAX_DIMENSION, MAX_OUTPUT_PIXELS, type UploadedImage } from '../types'
import { loadHtmlImage } from './files'
import { canvasBlob } from './render'
import scriptUrl from '../../node_modules/@bentopdf/gs-wasm/assets/gs.js?url'
import wasmUrl from '../../node_modules/@bentopdf/gs-wasm/assets/gs.wasm?url'

const SVG_NS = 'http://www.w3.org/2000/svg'
const svgElements = new Set(
  'svg g defs desc title metadata symbol use switch path rect circle ellipse line polyline polygon text tspan textPath a image clipPath mask pattern marker linearGradient radialGradient stop filter feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence style'.split(
    ' ',
  ),
)
export interface VectorOptions {
  scale?: number
  signal?: AbortSignal
}

function dimensions(width: number, height: number, requestedScale: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error('This vector has invalid dimensions. Please export it with a valid artboard.')
  const scale = Math.min(
    requestedScale,
    MAX_DIMENSION / width,
    MAX_DIMENSION / height,
    Math.sqrt(MAX_OUTPUT_PIXELS / (width * height)),
  )
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scale,
  }
}

function checkCss(value: string) {
  const css = value.replace(/\/\*[\s\S]*?\*\//g, '')
  if (/[\\@]/.test(css) || /expression\s*\(/i.test(css))
    throw new Error(
      'This SVG uses external resources or unsupported styles. Please embed images and use local SVG styles.',
    )
  // Every CSS URL must be a reference to a definition inside this SVG.
  for (const match of css.matchAll(/url\s*\(([^)]*)\)/gi)) {
    if (!/^\s*['"]?#[\w:.-]+['"]?\s*$/.test(match[1]))
      throw new Error(
        'This SVG references an external resource. Please embed all artwork before converting.',
      )
  }
}

function svgLength(value: string | null) {
  const match = value?.trim().match(/^([\d.]+)(px|pt|pc|in|cm|mm|q)?$/i)
  if (!match) return 0
  const units: Record<string, number> = {
    px: 1,
    pt: 96 / 72,
    pc: 16,
    in: 96,
    cm: 96 / 2.54,
    mm: 96 / 25.4,
    q: 96 / 101.6,
  }
  return Number(match[1]) * units[match[2]?.toLowerCase() || 'px']
}

async function rasterizeSvg(file: File, scale: number) {
  const text = await file.text()
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(text))
    throw new Error(
      'This SVG contains document declarations or linked styles. Please export a self-contained SVG.',
    )
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const root = doc.documentElement
  if (doc.querySelector('parsererror') || root.localName !== 'svg' || root.namespaceURI !== SVG_NS)
    throw new Error('This SVG is not valid. Please check the file and try again.')
  // Authoring metadata (for example RDF from Inkscape) is not part of the artwork.
  for (const metadata of Array.from(root.getElementsByTagNameNS(SVG_NS, 'metadata')))
    metadata.remove()
  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (element.namespaceURI !== SVG_NS || !svgElements.has(element.localName))
      throw new Error(
        'This SVG contains scripts, animation, or unsupported content. Please export a static SVG.',
      )
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.localName) || attribute.localName === 'base')
        throw new Error('This SVG contains active content. Please export a static SVG.')
      if (
        attribute.localName === 'href' &&
        !/^#[\w:.-]+$/.test(attribute.value) &&
        !(
          (element.localName === 'image' || element.localName === 'feImage') &&
          /^data:image\/(png|jpeg|webp|gif|avif);base64,[a-z\d+/=\s]+$/i.test(attribute.value)
        )
      )
        throw new Error(
          'This SVG references an external resource. Please embed all artwork before converting.',
        )
      if (attribute.localName !== 'href' && attribute.localName !== 'xmlns')
        checkCss(attribute.value)
    }
    if (element.localName === 'style') checkCss(element.textContent || '')
  }
  const box = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  const validBox = box?.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0
  if (root.hasAttribute('viewBox') && !validBox)
    throw new Error('This SVG has an invalid viewBox. Please export it with a valid artboard.')
  let width = svgLength(root.getAttribute('width'))
  let height = svgLength(root.getAttribute('height'))
  if (validBox) {
    if (!width && height) width = (height * box[2]) / box[3]
    if (!height && width) height = (width * box[3]) / box[2]
    width ||= box[2]
    height ||= box[3]
  }
  width ||= 300
  height ||= 150
  const size = dimensions(width, height, scale)
  if (!root.hasAttribute('viewBox')) root.setAttribute('viewBox', `0 0 ${width} ${height}`)
  root.setAttribute('width', String(size.width))
  root.setAttribute('height', String(size.height))
  root.setAttribute(
    'style',
    `${root.getAttribute('style') || ''};width:${size.width}px!important;height:${size.height}px!important`,
  )
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' }),
  )
  const canvas = document.createElement('canvas')
  try {
    const image = await loadHtmlImage(url)
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not prepare the SVG preview. Please try smaller dimensions.')
    ctx.drawImage(image, 0, 0, size.width, size.height)
    return { blob: await canvasBlob(canvas, 'image/png', 1), ...size }
  } finally {
    URL.revokeObjectURL(url)
    canvas.width = canvas.height = 1
  }
}

async function rasterizeEps(file: File, scale: number, signal?: AbortSignal) {
  let bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes[0] === 0xc5 && bytes[1] === 0xd0 && bytes[2] === 0xd3 && bytes[3] === 0xc6) {
    if (bytes.length < 30) throw new Error('This EPS has a damaged preview header.')
    const header = new DataView(bytes.buffer)
    const offset = header.getUint32(4, true),
      length = header.getUint32(8, true)
    if (offset < 30 || !length || offset + length > bytes.length)
      throw new Error('This EPS has an invalid PostScript section.')
    bytes = bytes.slice(offset, offset + length)
  }
  const text = new TextDecoder('latin1').decode(bytes)
  if (!/^%!PS-Adobe-[^\r\n]*EPSF-/.test(text))
    throw new Error(
      'This file is not a valid EPS image. Please export it as Encapsulated PostScript.',
    )
  const numeric = '(-?\\d+(?:\\.\\d+)?)'
  const boxPattern = (kind: string) =>
    new RegExp(
      `^%%${kind}:\\s*${numeric}\\s+${numeric}\\s+${numeric}\\s+${numeric}[^\\r\\n]*`,
      'gm',
    )
  // Ignore bounding boxes belonging to nested EPS documents.
  let depth = 0
  const topLevel: string[] = []
  for (const match of text.matchAll(
    /^%%(?:BeginDocument|EndDocument|HiResBoundingBox|BoundingBox):?[^\r\n]*/gm,
  )) {
    if (match[0].startsWith('%%BeginDocument')) depth++
    else if (match[0].startsWith('%%EndDocument')) depth = Math.max(0, depth - 1)
    else if (!depth) topLevel.push(match[0])
  }
  const comments = topLevel.join('\n')
  const boxes = [...comments.matchAll(boxPattern('HiResBoundingBox'))]
  if (!boxes.length) boxes.push(...comments.matchAll(boxPattern('BoundingBox')))
  const box = boxes[0]?.slice(1).map(Number)
  if (!box)
    throw new Error('This EPS has no bounding box. Please export it with a defined artboard.')
  const size = dimensions(box[2] - box[0], box[3] - box[1], scale)
  // Ghostscript needs the artboard in the header, even when EPS stores it in the trailer.
  // Patch comment bytes only; leave embedded binary image/font data untouched.
  const headerEnd = text.search(/^(?:%%EndComments|[^%\r\n])/m)
  const patches = [
    ...text
      .slice(0, headerEnd < 0 ? text.length : headerEnd)
      .matchAll(/^%%(?:HiRes)?BoundingBox:[^\r\n]*/gm),
  ]
  const parts: BlobPart[] = []
  let cursor = 0
  for (const match of patches) {
    parts.push(bytes.slice(cursor, match.index), `${match[0].split(':')[0]}: ${box.join(' ')}`)
    cursor = match.index! + match[0].length
  }
  parts.push(bytes.slice(cursor))
  bytes = new Uint8Array(await new Blob(parts).arrayBuffer())
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const blob = await new Promise<Blob>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/eps.worker.ts', import.meta.url), {
      type: 'module',
    })
    const clean = () => {
      clearTimeout(timer)
      worker.terminate()
      signal?.removeEventListener('abort', abort)
    }
    const abort = () => {
      clean()
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      clean()
      reject(
        new Error(
          'This EPS took too long to convert. Please simplify the artwork or choose a lower resolution.',
        ),
      )
    }, 45_000)
    signal?.addEventListener('abort', abort, { once: true })
    worker.onmessage = ({ data }) => {
      clean()
      data.blob
        ? resolve(data.blob)
        : reject(
            new Error(
              'This EPS could not be rendered. Please check that its fonts and artwork are embedded.',
            ),
          )
    }
    worker.onerror = () => {
      clean()
      reject(new Error('Could not load the EPS converter. Please reload the page and try again.'))
    }
    worker.postMessage(
      {
        bytes,
        ...size,
        scriptUrl: new URL(scriptUrl, location.href).href,
        wasmUrl: new URL(wasmUrl, location.href).href,
      },
      [bytes.buffer],
    )
  })
  return { blob, ...size }
}

export async function loadVector(
  file: File,
  { scale = 2, signal }: VectorOptions,
): Promise<UploadedImage> {
  if (![1, 2, 4].includes(scale)) scale = 2
  const eps = /\.eps$/i.test(file.name) || file.type === 'application/postscript'
  const result = eps ? await rasterizeEps(file, scale, signal) : await rasterizeSvg(file, scale)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return {
    blob: result.blob,
    url: URL.createObjectURL(result.blob),
    width: result.width,
    height: result.height,
    name: file.name,
    type: eps ? 'application/postscript' : 'image/svg+xml',
    originalSize: file.size,
    vectorScale: result.scale,
  }
}
