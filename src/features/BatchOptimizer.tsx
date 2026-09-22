import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  Check,
  Download,
  FileImage,
  Layers,
  LoaderCircle,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { ACCEPT, type Format, type UploadedImage } from '../types'
import { FormatPicker, RangeControl } from '../components/Controls'
import {
  baseName,
  downloadBlob,
  formatBytes,
  friendlyError,
  loadFile,
  outputName,
} from '../utils/files'
import { initialSettings, processImage } from '../utils/processing'

interface BatchItem {
  id: number
  image: UploadedImage
  status: 'waiting' | 'processing' | 'done' | 'error'
  output?: Blob
  error?: string
}
export default function BatchOptimizer({ formats }: { formats: Format[] }) {
  const [items, setItems] = useState<BatchItem[]>([])
  const [format, setFormat] = useState<Format>(
    formats.includes('image/webp') ? 'image/webp' : 'image/png',
  )
  const [quality, setQuality] = useState(90)
  const [maxWidth, setMaxWidth] = useState('')
  const [maxHeight, setMaxHeight] = useState('')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const live = useRef(true),
    nextId = useRef(0)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      controller.current?.abort()
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.image.url))
    }
  }, [])
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if ((event.target as HTMLElement)?.matches?.('input,textarea') || busy || adding) return
      const files = Array.from(event.clipboardData?.files || [])
      if (files.length) {
        event.preventDefault()
        void addFiles(files)
      }
    }
    window.addEventListener('paste', paste)
    return () => window.removeEventListener('paste', paste)
  })
  async function addFiles(files: File[]) {
    if (busy || adding) return
    setAdding(true)
    setError('')
    const existingBytes = itemsRef.current.reduce(
      (sum, item) => sum + (item.image.originalSize ?? item.image.blob.size),
      0,
    )
    if (
      files.length + itemsRef.current.length > 30 ||
      existingBytes + files.reduce((sum, file) => sum + file.size, 0) > 250 * 1024 * 1024
    ) {
      setError('Please keep each batch to 30 images and 250 MB in total.')
      setAdding(false)
      return
    }
    const errors: string[] = []
    for (const file of files) {
      try {
        const image = await loadFile(file)
        if (!live.current) {
          URL.revokeObjectURL(image.url)
          return
        }
        setItems((list) => [...list, { id: ++nextId.current, image, status: 'waiting' }])
      } catch (e) {
        errors.push(`${file.name}: ${friendlyError(e)}`)
      }
    }
    if (live.current) {
      setError(errors.join(' '))
      setAdding(false)
    }
  }
  function invalidate() {
    setItems((list) =>
      list.map((i) => ({ ...i, status: 'waiting', output: undefined, error: undefined })),
    )
  }
  async function optimize() {
    const w = Number(maxWidth),
      h = Number(maxHeight)
    if (
      (maxWidth && (!Number.isInteger(w) || w < 1 || w > 8192)) ||
      (maxHeight && (!Number.isInteger(h) || h < 1 || h > 8192))
    ) {
      setError('Please use maximum dimensions between 1 and 8192 pixels.')
      return
    }
    setBusy(true)
    setError('')
    controller.current = new AbortController()
    for (const item of items) {
      if (controller.current.signal.aborted) break
      if (item.status === 'done') continue
      setItems((list) =>
        list.map((i) => (i.id === item.id ? { ...i, status: 'processing', error: undefined } : i)),
      )
      try {
        const settings = initialSettings(item.image, formats)
        const scale = Math.min(
          1,
          w > 0 ? w / item.image.width : 1,
          h > 0 ? h / item.image.height : 1,
          settings.width / item.image.width,
          settings.height / item.image.height,
        )
        const blob = await processImage(
          {
            ...settings,
            format,
            quality,
            width: Math.max(1, Math.floor(item.image.width * scale)),
            height: Math.max(1, Math.floor(item.image.height * scale)),
          },
          item.image,
          controller.current.signal,
        )
        if (live.current)
          setItems((list) =>
            list.map((i) => (i.id === item.id ? { ...i, status: 'done', output: blob } : i)),
          )
      } catch (e) {
        if (live.current)
          setItems((list) =>
            list.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: controller.current?.signal.aborted ? 'waiting' : 'error',
                    error: controller.current?.signal.aborted ? undefined : friendlyError(e),
                  }
                : i,
            ),
          )
      }
    }
    if (live.current) setBusy(false)
  }
  async function zipAll() {
    setZipping(true)
    setError('')
    try {
      const { zip } = await import('fflate')
      const files: Record<string, Uint8Array> = {}
      const used = new Set<string>()
      for (const item of items.filter((i) => i.output)) {
        const name = `${baseName(item.image.name)}-optimized`
        let unique = outputName(name, format),
          index = 2
        while (used.has(unique)) unique = outputName(`${name}-${index++}`, format)
        used.add(unique)
        files[unique] = new Uint8Array(await item.output!.arrayBuffer())
      }
      const zipped = await new Promise<Uint8Array>((resolve, reject) =>
        zip(files, { level: 0 }, (error, data) => (error ? reject(error) : resolve(data))),
      )
      if (live.current)
        downloadBlob(
          new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' }),
          'pixelchange-optimized.zip',
        )
    } catch {
      if (live.current)
        setError(
          'Could not create this ZIP. Try downloading the images individually or using a smaller batch.',
        )
    } finally {
      if (live.current) setZipping(false)
    }
  }
  const complete = items.filter((i) => i.status === 'done').length
  const before = items
    .filter((i) => i.output)
    .reduce((sum, i) => sum + (i.image.originalSize ?? i.image.blob.size), 0)
  const after = items.reduce((sum, i) => sum + (i.output?.size || 0), 0)
  return (
    <section
      className="batch-layout"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        void addFiles(Array.from(e.dataTransfer.files))
      }}
    >
      <input
        className="sr-only"
        tabIndex={-1}
        type="file"
        multiple
        ref={input}
        accept={ACCEPT}
        onChange={(e) => {
          void addFiles(Array.from(e.target.files || []))
          e.target.value = ''
        }}
      />
      <div className="batch-main">
        <div
          className="batch-drop"
          role="button"
          tabIndex={busy || adding ? -1 : 0}
          aria-disabled={busy || adding}
          onClick={() => {
            if (!busy && !adding) input.current?.click()
          }}
          onKeyDown={(e) => {
            if (!busy && !adding && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              input.current?.click()
            }
          }}
        >
          <span className="empty-icon">
            <Layers size={29} strokeWidth={1.6} />
          </span>
          <h2>A whole folder. A little lighter.</h2>
          <p>
            Drop images here or <span>browse files</span>
          </p>
          <small>
            {adding ? 'Opening your images…' : 'Up to 30 images · 50 MB each · 250 MB per batch'}
          </small>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}>
              <X size={16} />
            </button>
          </div>
        )}
        <div className="batch-list">
          <div className="batch-list-header">
            <h3>
              Your images <span>{items.length}</span>
            </h3>
            <button
              className="text-button"
              disabled={busy || adding || !items.length}
              onClick={() => {
                items.forEach((i) => URL.revokeObjectURL(i.image.url))
                setItems([])
              }}
            >
              <Trash2 size={14} />
              Clear all
            </button>
          </div>
          {!items.length && (
            <div className="batch-empty">
              <FileImage size={25} />
              <p>Your images will appear here.</p>
              <span>One set of settings. Every image taken care of.</span>
            </div>
          )}
          {items.map((item) => (
            <div className="batch-item" key={item.id}>
              <img src={item.image.url} alt="" />
              <div className="batch-file">
                <strong title={item.image.name}>{item.image.name}</strong>
                <span>
                  {formatBytes(item.image.originalSize ?? item.image.blob.size)}
                  {item.output && (
                    <>
                      {' '}
                      <span>→</span> {formatBytes(item.output.size)}
                    </>
                  )}
                  {item.status === 'waiting' && ' · Ready'}
                </span>
                {item.error && <span className="inline-error">{item.error}</span>}
              </div>
              {item.status === 'processing' && <LoaderCircle size={19} className="spin purple" />}
              {item.output && (
                <button
                  className="icon-button"
                  aria-label={`Download ${item.image.name}`}
                  onClick={() =>
                    downloadBlob(
                      item.output!,
                      outputName(`${baseName(item.image.name)}-optimized`, format),
                    )
                  }
                >
                  <Download size={18} />
                </button>
              )}
              <button
                className="icon-button"
                disabled={busy || adding}
                aria-label={`Remove ${item.image.name}`}
                onClick={() => {
                  URL.revokeObjectURL(item.image.url)
                  setItems((list) => list.filter((i) => i.id !== item.id))
                }}
              >
                <X size={17} />
              </button>
            </div>
          ))}
          {!!items.length && (
            <button
              className="batch-add"
              disabled={busy || adding}
              onClick={() => input.current?.click()}
            >
              <Plus size={16} />
              Add more images
            </button>
          )}
        </div>
      </div>
      <aside className="batch-sidebar">
        <div className="controls-card">
          <div className="batch-settings-title">
            <Layers size={19} />
            <h3>One batch. One setup.</h3>
          </div>
          <div className="controls-body">
            <fieldset disabled={busy || zipping}>
              <label className="field-label">Output format</label>
              <FormatPicker
                formats={formats}
                value={format}
                onChange={(v) => {
                  setFormat(v)
                  invalidate()
                }}
              />
              <p className="field-hint">Applied to every image in your batch.</p>
              <div className="control-divider" />
              <RangeControl
                label="Image quality"
                value={quality}
                onChange={(v) => {
                  setQuality(v)
                  invalidate()
                }}
                disabled={format === 'image/png'}
              />
              <p className="field-hint">
                {format === 'image/png'
                  ? 'PNG uses lossless encoding.'
                  : '90% is a great place to start.'}
              </p>
              <div className="control-divider" />
              <label className="field-label">
                Fit within dimensions <span className="muted">(optional)</span>
              </label>
              <div className="dimension-row">
                <label className="dimension-field">
                  Max width
                  <span>
                    <input
                      type="number"
                      min="1"
                      max="8192"
                      placeholder="Original"
                      value={maxWidth}
                      onChange={(e) => {
                        setMaxWidth(e.target.value)
                        invalidate()
                      }}
                    />
                    <span>px</span>
                  </span>
                </label>
                <label className="dimension-field">
                  Max height
                  <span>
                    <input
                      type="number"
                      min="1"
                      max="8192"
                      placeholder="Original"
                      value={maxHeight}
                      onChange={(e) => {
                        setMaxHeight(e.target.value)
                        invalidate()
                      }}
                    />
                    <span>px</span>
                  </span>
                </label>
              </div>
              <p className="field-hint">
                Keep proportions. Never upscale. JPG uses a white background. Metadata is removed.
              </p>
            </fieldset>
            <button
              className="button primary full-width"
              disabled={busy || adding || zipping || !items.length}
              onClick={optimize}
            >
              {busy ? <LoaderCircle size={17} className="spin" /> : <Upload size={17} />}
              {busy
                ? `Optimizing ${complete} of ${items.length}`
                : complete === items.length && items.length
                  ? 'All images optimized'
                  : 'Optimize all images'}
            </button>
            {busy && (
              <button
                className="text-button full-width cancel-batch"
                onClick={() => controller.current?.abort()}
              >
                Cancel processing
              </button>
            )}
            {!!items.length && (
              <div className="batch-progress">
                <progress
                  aria-label="Batch optimization progress"
                  value={complete}
                  max={items.length}
                />
                <span>
                  {complete} of {items.length} images optimized
                </span>
              </div>
            )}
          </div>
        </div>
        {complete > 0 && (
          <div className="download-card">
            <div className="batch-result">
              <Check size={19} />
              <strong>{complete} images, ready to go.</strong>
            </div>
            <p className="batch-savings">
              <ArrowDown size={14} />
              {formatBytes(before)} → {formatBytes(after)}
            </p>
            <button
              className="button primary full-width"
              disabled={busy || zipping}
              onClick={zipAll}
            >
              {zipping ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />}
              {zipping ? 'Creating ZIP…' : 'Download all as ZIP'}
            </button>
          </div>
        )}
      </aside>
    </section>
  )
}
