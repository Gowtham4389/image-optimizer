import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Type, Upload, LoaderCircle, Trash2, ShieldCheck } from 'lucide-react'
import type { Editor } from '../hooks/useEditor'
import { ACCEPT, type Watermark } from '../types'
import { RangeControl, Toggle } from '../components/Fields'
import { friendlyError, loadFile } from '../utils/files'

const POSITIONS = [
  { label: 'Top left', x: 0, y: 0 },
  { label: 'Top center', x: 50, y: 0 },
  { label: 'Top right', x: 100, y: 0 },
  { label: 'Center left', x: 0, y: 50 },
  { label: 'Center', x: 50, y: 50 },
  { label: 'Center right', x: 100, y: 50 },
  { label: 'Bottom left', x: 0, y: 100 },
  { label: 'Bottom center', x: 50, y: 100 },
  { label: 'Bottom right', x: 100, y: 100 },
]
export default function WatermarkControls({ editor }: { editor: Editor }) {
  const mark = editor.settings!.watermark
  const input = useRef<HTMLInputElement>(null)
  const uploadVersion = useRef(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  useEffect(() => {
    uploadVersion.current++
    setBusy(false)
    setError('')
    return () => {
      uploadVersion.current++
    }
  }, [editor.image])
  useEffect(() => {
    if (!mark.image) {
      setThumbnail('')
      return
    }
    const url = URL.createObjectURL(mark.image.blob)
    setThumbnail(url)
    return () => URL.revokeObjectURL(url)
  }, [mark.image])
  const update = (patch: Partial<Watermark>) => {
    if (Object.entries(patch).some(([key, value]) => mark[key as keyof Watermark] !== value)) {
      editor.update({ watermark: { ...mark, ...patch } })
    }
  }
  async function upload(file: File) {
    const version = ++uploadVersion.current
    setBusy(true)
    setError('')
    try {
      const loaded = await loadFile(file)
      try {
        if (version === uploadVersion.current) {
          update({
            kind: 'image',
            enabled: true,
            image: {
              blob: loaded.blob,
              name: loaded.name,
              width: loaded.width,
              height: loaded.height,
            },
          })
        }
      } finally {
        URL.revokeObjectURL(loaded.url)
      }
    } catch (e) {
      if (version === uploadVersion.current) setError(friendlyError(e))
    } finally {
      if (version === uploadVersion.current) setBusy(false)
    }
  }
  const hasContent = mark.kind === 'text' ? !!mark.text.trim() : !!mark.image
  return (
    <div className="watermark-controls">
      <div className="section-heading">
        <h3>Leave your mark.</h3>
        <p>A name, a logo, a little signature.</p>
      </div>
      <fieldset disabled={busy}>
        <div className="watermark-type" role="group" aria-label="Watermark type">
          <button aria-pressed={mark.kind === 'text'} onClick={() => update({ kind: 'text' })}>
            <Type size={17} />
            Text
          </button>
          <button aria-pressed={mark.kind === 'image'} onClick={() => update({ kind: 'image' })}>
            <ImagePlus size={17} />
            Image
          </button>
        </div>
        {mark.kind === 'text' ? (
          <>
            <label className="field-label" htmlFor="watermark-text">
              Watermark text
            </label>
            <input
              className="watermark-text"
              id="watermark-text"
              type="text"
              maxLength={120}
              placeholder="© Your name or brand"
              value={mark.text}
              onChange={(e) => update({ text: e.target.value, enabled: true })}
            />
            <label className="color-field">
              Text color
              <span>
                <input
                  aria-label="Watermark text color"
                  type="color"
                  value={mark.color}
                  onChange={(e) => update({ color: e.target.value })}
                />
                {mark.color.toUpperCase()}
              </span>
            </label>
          </>
        ) : (
          <div
            className="watermark-image-section"
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDragLeave={(e) => e.stopPropagation()}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!busy && e.dataTransfer.files[0]) void upload(e.dataTransfer.files[0])
            }}
          >
            <input
              ref={input}
              className="sr-only"
              tabIndex={-1}
              type="file"
              accept={ACCEPT}
              aria-label="Upload watermark image"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void upload(file)
                e.target.value = ''
              }}
            />
            {mark.image && (
              <div className="watermark-file">
                {thumbnail && <img src={thumbnail} alt="Watermark logo" />}
                <span title={mark.image.name}>{mark.image.name}</span>
                <button
                  className="icon-button"
                  aria-label="Remove watermark image"
                  onClick={() => update({ image: null, enabled: false })}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
            <button className="watermark-upload" onClick={() => input.current?.click()}>
              {busy ? <LoaderCircle className="spin" size={19} /> : <Upload size={19} />}
              <span>
                {busy
                  ? 'Opening your logo…'
                  : mark.image
                    ? 'Replace watermark image'
                    : 'Choose watermark image'}
              </span>
            </button>
            <p className="field-hint">
              Or drop a logo here. A transparent PNG works best. Up to 50 MB; animated images use a
              still frame.
            </p>
          </div>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <Toggle
          label="Show watermark"
          description="Include it in your preview and download."
          checked={mark.enabled && hasContent}
          disabled={!hasContent}
          onChange={(enabled) => update({ enabled })}
        />
        <div className="control-divider" />
        <RangeControl
          label="Watermark opacity"
          min={0}
          value={mark.opacity}
          onChange={(opacity) => update({ opacity })}
        />
        <div className="range-labels">
          <span>Transparent</span>
          <span>Opaque</span>
        </div>
        <RangeControl
          label="Watermark size"
          min={5}
          max={90}
          value={mark.size}
          onChange={(size) => update({ size })}
        />
        <p className="field-hint">Percentage of the output width. Always fits inside your image.</p>
        <label htmlFor="watermark-position" className="field-label">
          Position
        </label>
        <select
          className="watermark-position"
          id="watermark-position"
          value={POSITIONS.findIndex((p) => p.x === mark.x && p.y === mark.y)}
          onChange={(e) => {
            const position = POSITIONS[+e.target.value]
            if (position) update({ x: position.x, y: position.y })
          }}
        >
          <option value={-1} disabled>
            Custom position
          </option>
          {POSITIONS.map((p, index) => (
            <option key={p.label} value={index}>
              {p.label}
            </option>
          ))}
        </select>
        <details className="watermark-placement">
          <summary>Fine-tune placement</summary>
          <RangeControl
            label="Watermark horizontal position"
            min={0}
            value={mark.x}
            onChange={(x) => update({ x })}
          />
          <RangeControl
            label="Watermark vertical position"
            min={0}
            value={mark.y}
            onChange={(y) => update({ y })}
          />
        </details>
      </fieldset>
      <div className="info-note">
        <ShieldCheck size={16} />
        <span>
          Your watermark stays editable after cropping or resizing. Everything stays on your device.
        </span>
      </div>
    </div>
  )
}
