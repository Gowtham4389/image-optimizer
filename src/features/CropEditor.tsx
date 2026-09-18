import { useEffect, useRef, useState } from 'react'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'
import {
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  Minus,
  Plus,
  Move,
  Crop,
  Check,
  LoaderCircle,
} from 'lucide-react'
import { Modal } from '../components/Modal'
import type { Settings } from '../types'
import { processImage } from '../utils/processing'
import { canvasBlob } from '../utils/render'
import { friendlyError } from '../utils/files'

const RATIOS = ['Free', 'Original', '1:1', '4:3', '3:2', '16:9', '9:16', '4:5', '5:4']
export default function CropEditor({
  settings,
  onApply,
  onClose,
}: {
  settings: Settings
  onApply: (blob: Blob, width: number, height: number) => void
  onClose: () => void
}) {
  const imageRef = useRef<HTMLImageElement>(null)
  const cropper = useRef<Cropper | null>(null)
  const [url, setUrl] = useState('')
  const [ratio, setRatio] = useState('Free')
  const [size, setSize] = useState({ width: 0, height: 0, x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [move, setMove] = useState(false)
  const sideways = settings.rotation % 180 !== 0
  useEffect(() => {
    const abort = new AbortController()
    let objectUrl = ''
    const naturalWidth = sideways ? settings.source.height : settings.source.width
    const naturalHeight = sideways ? settings.source.width : settings.source.height
    const scale = Math.min(
      1,
      8192 / naturalWidth,
      8192 / naturalHeight,
      Math.sqrt(24_000_000 / (naturalWidth * naturalHeight)),
    )
    void processImage(
      {
        ...settings,
        format: 'image/png',
        // The watermark stays editable and is composited once, after the crop.
        watermark: { ...settings.watermark, enabled: false },
        width: Math.floor(naturalWidth * scale),
        height: Math.floor(naturalHeight * scale),
        removeMetadata: true,
      },
      undefined,
      abort.signal,
    )
      .then((blob) => {
        if (!abort.signal.aborted) {
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(friendlyError(e))
      })
    return () => {
      abort.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [settings, sideways])
  useEffect(() => {
    if (!url || !imageRef.current) return
    const instance = new Cropper(imageRef.current, {
      viewMode: 1,
      dragMode: 'crop',
      autoCropArea: 0.85,
      background: true,
      responsive: true,
      checkOrientation: false,
      zoomOnWheel: true,
      ready() {
        setReady(true)
      },
      crop(event) {
        setSize({
          width: Math.round(event.detail.width),
          height: Math.round(event.detail.height),
          x: Math.round(event.detail.x),
          y: Math.round(event.detail.y),
        })
      },
    })
    cropper.current = instance
    return () => {
      instance.destroy()
      cropper.current = null
    }
  }, [url])
  function changeRatio(value: string) {
    setRatio(value)
    const numbers = value.split(':').map(Number)
    cropper.current?.setAspectRatio(
      value === 'Free'
        ? NaN
        : value === 'Original'
          ? sideways
            ? settings.source.height / settings.source.width
            : settings.source.width / settings.source.height
          : numbers[0] / numbers[1],
    )
  }
  async function apply() {
    if (!cropper.current || busy || !ready) return
    setBusy(true)
    setError('')
    let canvas: HTMLCanvasElement | undefined
    try {
      canvas = cropper.current.getCroppedCanvas({
        maxWidth: 8192,
        maxHeight: 8192,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      })
      if (!canvas?.width || canvas.width * canvas.height > 24_000_000)
        throw new Error('Please select a crop smaller than 24 megapixels.')
      const blob = await canvasBlob(canvas, 'image/png', 1)
      onApply(blob, canvas.width, canvas.height)
      onClose()
    } catch (error) {
      setError(friendlyError(error))
    } finally {
      if (canvas) {
        canvas.width = 1
        canvas.height = 1
      }
      setBusy(false)
    }
  }
  function flip(axis: 'X' | 'Y') {
    const c = cropper.current
    if (!c) return
    const data = c.getData()
    if (axis === 'X') c.scaleX(-data.scaleX || -1)
    else c.scaleY(-data.scaleY || -1)
  }
  return (
    <Modal title="Find your perfect frame" onClose={onClose} wide>
      <div className="crop-modal-body">
        <p className="muted">
          Drag the handles to crop. Switch to Move to position the image underneath.
        </p>
        <div className="crop-ratios">
          {RATIOS.map((r) => (
            <button
              className={ratio === r ? 'selected' : ''}
              key={r}
              onClick={() => changeRatio(r)}
              disabled={!ready}
            >
              {r}
            </button>
          ))}
        </div>
        <div
          className="crop-stage"
          tabIndex={0}
          role="group"
          aria-label="Image crop area. Arrow keys move the selection. Shift plus arrow keys resize it."
          onKeyDown={(e) => {
            if (!e.key.startsWith('Arrow') || !cropper.current) return
            e.preventDefault()
            const d = cropper.current.getData()
            const step = e.altKey ? 1 : 10
            const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0
            const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0
            cropper.current.setData(
              e.shiftKey
                ? { width: Math.max(1, d.width + dx), height: Math.max(1, d.height + dy) }
                : { x: d.x + dx, y: d.y + dy },
            )
          }}
        >
          {url ? (
            <img ref={imageRef} src={url} alt="Image to crop" />
          ) : (
            <span className="loading-label">
              <LoaderCircle className="spin" size={21} />
              Preparing your image…
            </span>
          )}
        </div>
        <div className="crop-toolbar">
          <div className="button-group">
            <button
              className={`icon-button ${move ? 'active' : ''}`}
              title={move ? 'Switch to crop mode' : 'Move image underneath crop'}
              aria-label={move ? 'Switch to crop mode' : 'Move image underneath crop'}
              disabled={!ready}
              onClick={() => {
                cropper.current?.setDragMode(move ? 'crop' : 'move')
                setMove(!move)
              }}
            >
              {move ? <Move size={18} /> : <Crop size={18} />}
            </button>
            {[
              { label: 'Zoom out', icon: Minus, action: () => cropper.current?.zoom(-0.1) },
              { label: 'Zoom in', icon: Plus, action: () => cropper.current?.zoom(0.1) },
              { label: 'Rotate left', icon: RotateCcw, action: () => cropper.current?.rotate(-90) },
              { label: 'Rotate right', icon: RotateCw, action: () => cropper.current?.rotate(90) },
              { label: 'Flip horizontal', icon: FlipHorizontal2, action: () => flip('X') },
              { label: 'Flip vertical', icon: FlipVertical2, action: () => flip('Y') },
            ].map((b) => (
              <button
                className="icon-button"
                key={b.label}
                title={b.label}
                aria-label={b.label}
                onClick={b.action}
                disabled={!ready}
              >
                <b.icon size={18} />
              </button>
            ))}
          </div>
          <span className="crop-dimensions" aria-live="polite">
            {size.width} × {size.height} px
          </span>
        </div>
        <div className="crop-numeric">
          {(['x', 'y', 'width', 'height'] as const).map((key) => (
            <label key={key}>
              {key[0].toUpperCase() + key.slice(1)}
              <input
                aria-label={`Crop ${key}`}
                type="number"
                min={key === 'width' || key === 'height' ? 1 : 0}
                value={size[key]}
                disabled={!ready}
                onChange={(e) => cropper.current?.setData({ [key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
        <p className="field-hint">
          Keyboard: arrow keys move the crop · Shift + arrows resize · Alt for 1 px steps.
        </p>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            className="text-button"
            disabled={!ready}
            onClick={() => {
              cropper.current?.reset()
              changeRatio('Free')
            }}
          >
            Reset crop
          </button>
          <div className="button-group">
            <button className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="button primary" onClick={apply} disabled={busy || !ready}>
              {busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}Apply crop
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
