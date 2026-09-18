import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Check,
  Download,
  Expand,
  FileImage,
  ImagePlus,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Undo2,
  Redo2,
  Upload,
  X,
} from 'lucide-react'
import type { Editor } from '../hooks/useEditor'
import { downloadBlob, extension, formatBytes, outputName } from '../utils/files'

export function EmptyWorkspace({ onChoose }: { onChoose: () => void }) {
  return (
    <div className="empty-workspace">
      <span className="empty-icon">
        <ImagePlus size={34} strokeWidth={1.5} />
      </span>
      <h2>A better image starts here.</h2>
      <p>Drop your image, paste it, or choose a file.</p>
      <button className="button primary" onClick={onChoose}>
        <Upload size={17} />
        Choose image
      </button>
      <span>JPG, PNG, WebP, AVIF, GIF, BMP, SVG, EPS · Up to 50 MB</span>
    </div>
  )
}
export function Workspace({
  editor,
  onChoose,
  onDownload,
}: {
  editor: Editor
  onChoose: () => void
  onDownload: () => void
}) {
  const [view, setView] = useState<'original' | 'optimized' | 'compare'>('optimized')
  const [zoom, setZoom] = useState(100)
  const [split, setSplit] = useState(50)
  const [expanded, setExpanded] = useState(false)
  const { image, output, settings, processing } = editor
  useEffect(() => {
    setZoom(100)
    setView('optimized')
  }, [image])
  useEffect(() => {
    if (!expanded) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [expanded])
  if (!image || !settings) return <EmptyWorkspace onChoose={onChoose} />
  const saved = output ? (1 - output.blob.size / (image.originalSize ?? image.blob.size)) * 100 : 0
  return (
    <div className={`workspace-card ${expanded ? 'is-expanded' : ''}`}>
      <div className="workspace-header">
        <div className="file-icon">
          <FileImage size={20} strokeWidth={1.7} />
        </div>
        <div className="file-title">
          <strong title={image.name}>{image.name}</strong>
          <span>
            {formatBytes(image.originalSize ?? image.blob.size)}
            <i />
            {image.width} × {image.height} px
          </span>
        </div>
        {image.sample && <span className="sample-badge">Sample image</span>}
        <button
          className="icon-button replace-button"
          title="Drop an image here, or click to choose a new image"
          aria-label="Choose a new image"
          onClick={onChoose}
        >
          <ImagePlus size={19} />
          <span>Drop image here</span>
        </button>
        {expanded && (
          <button
            className="icon-button"
            aria-label="Close expanded preview"
            onClick={() => setExpanded(false)}
          >
            <X size={20} />
          </button>
        )}
      </div>
      <div className="preview-container">
        <div className="preview-topbar">
          <div className="view-switch" role="group" aria-label="Preview mode">
            {(['original', 'optimized', 'compare'] as const).map((v) => (
              <button
                key={v}
                className={view === v ? 'selected' : ''}
                onClick={() => setView(v)}
                disabled={v !== 'original' && !output}
              >
                {v[0].toUpperCase() + v.slice(1)}
                {v === 'optimized' && <span className="status-dot" />}
              </button>
            ))}
          </div>
          <span className="preview-status">
            {processing ? (
              <>
                <LoaderCircle size={13} className="spin" />
                Optimizing
              </>
            ) : (
              <>
                <Check size={13} />
                Ready to go
              </>
            )}
          </span>
        </div>
        <div className={`image-viewport ${view === 'compare' ? 'comparison' : ''}`}>
          <div className="image-inner" style={{ width: `${zoom}%`, minWidth: `${zoom}%` }}>
            {view === 'compare' && output ? (
              <div
                className="compare-frame"
                style={{ aspectRatio: `${image.width} / ${image.height}` }}
              >
                <img src={image.url} alt="Original image" draggable={false} />
                <div
                  className="compare-overlay"
                  style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                >
                  <img src={output.url} alt="Optimized image" draggable={false} />
                </div>
                <span className="compare-line" style={{ left: `${split}%` }}>
                  <span>‹ ›</span>
                </span>
                <span className="compare-tag left">Optimized</span>
                <span className="compare-tag right">Original</span>
                <input
                  aria-label="Before and after comparison"
                  className="comparison-range"
                  type="range"
                  min="0"
                  max="100"
                  value={split}
                  onChange={(e) => setSplit(+e.target.value)}
                />
              </div>
            ) : (
              <img
                className="preview-image"
                src={view === 'original' ? image.url : output?.url || image.url}
                alt={view === 'original' ? 'Original uploaded image' : 'Optimized image preview'}
                draggable={false}
              />
            )}
          </div>
        </div>
        {image.sample && (
          <div className="sample-caption">
            Meet your new favorite view.{' '}
            <button onClick={onChoose}>
              Try your own image <ArrowRight size={12} />
            </button>
          </div>
        )}
        <div className="preview-toolbar">
          <div className="button-group">
            <button
              className="icon-button"
              aria-label="Undo"
              title="Undo (⌘/Ctrl Z)"
              disabled={!editor.canUndo}
              onClick={editor.undo}
            >
              <Undo2 size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Redo"
              title="Redo (⌘/Ctrl Shift Z)"
              disabled={!editor.canRedo}
              onClick={editor.redo}
            >
              <Redo2 size={17} />
            </button>
            <span className="toolbar-divider" />
            <button
              className="icon-button"
              aria-label="Rotate image left"
              title="Rotate left"
              onClick={() =>
                editor.update({
                  rotation: (settings.rotation + 270) % 360,
                  width: settings.height,
                  height: settings.width,
                })
              }
            >
              <RotateCcw size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Rotate image right"
              title="Rotate right"
              onClick={() =>
                editor.update({
                  rotation: (settings.rotation + 90) % 360,
                  width: settings.height,
                  height: settings.width,
                })
              }
            >
              <RotateCw size={16} />
            </button>
          </div>
          <div className="button-group zoom-tools">
            <button
              className="icon-button"
              aria-label="Zoom preview out"
              disabled={zoom <= 25}
              onClick={() => setZoom((z) => Math.max(25, z - 25))}
            >
              <Minus size={16} />
            </button>
            <button className="zoom-value" title="Reset preview zoom" onClick={() => setZoom(100)}>
              {zoom}%
            </button>
            <button
              className="icon-button"
              aria-label="Zoom preview in"
              disabled={zoom >= 200}
              onClick={() => setZoom((z) => Math.min(200, z + 25))}
            >
              <Plus size={16} />
            </button>
            <span className="toolbar-divider" />
            <button
              className="icon-button"
              aria-label={expanded ? 'Close expanded preview' : 'Expand preview'}
              title="Expand preview"
              onClick={() => setExpanded((v) => !v)}
            >
              <Expand size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className="image-statistics">
        <div className="image-stat">
          <span className="stat-label">ORIGINAL</span>
          <strong>
            {formatBytes(image.originalSize ?? image.blob.size)}{' '}
            <span>{extension(image.type).toUpperCase()}</span>
          </strong>
          <small>
            {image.width.toLocaleString()} × {image.height.toLocaleString()} px
          </small>
        </div>
        <span className="stat-arrow">
          <ArrowRight size={20} />
        </span>
        <div className="image-stat">
          <span className="stat-label">OPTIMIZED</span>
          <strong>
            {output ? formatBytes(output.blob.size) : '—'}{' '}
            <span>{extension(settings.format).toUpperCase()}</span>
          </strong>
          <small>
            {settings.width.toLocaleString()} × {settings.height.toLocaleString()} px
          </small>
        </div>
        <div className={`savings ${saved < 0 ? 'larger' : ''}`}>
          <span>
            {processing ? (
              <LoaderCircle size={14} className="spin" />
            ) : saved >= 0 ? (
              <ArrowDown size={14} />
            ) : (
              <ArrowRight size={14} />
            )}
            {output
              ? `${Math.abs(saved).toFixed(1)}% ${saved >= 0 ? 'smaller' : 'larger'}`
              : 'Preparing…'}
          </span>
          <small>
            {saved >= 0 ? 'A lighter image. A faster web.' : 'Try WebP or lower dimensions.'}
          </small>
        </div>
      </div>
      <div className="workspace-bottom">
        <span>
          <span className="status-dot" />
          {processing ? 'Updating your preview…' : 'Changes are previewed automatically'}
          {view === 'compare' && ' · Images fitted to the same frame'}
        </span>
        <button className="text-button" onClick={onDownload} disabled={!output || processing}>
          <Download size={13} />
          Save image
        </button>
      </div>
    </div>
  )
}
export function DownloadCard({ editor, onDownload }: { editor: Editor; onDownload: () => void }) {
  const { settings, output, processing } = editor
  if (!settings) return null
  return (
    <div className="download-card">
      <div className="field-heading">
        <label htmlFor="download-name">Make it yours</label>
        <span>READY WHEN YOU ARE</span>
      </div>
      <div className="filename-input">
        <input
          id="download-name"
          aria-label="Download filename"
          value={editor.filename}
          maxLength={180}
          onChange={(e) => editor.setFilename(e.target.value)}
        />
        <span>.{extension(settings.format)}</span>
      </div>
      <button
        className="button primary download-button"
        onClick={onDownload}
        disabled={!output || processing || editor.loading}
      >
        {processing ? <LoaderCircle size={18} className="spin" /> : <Download size={18} />}
        <span>{processing ? 'Optimizing image…' : 'Download image'}</span>
        <span className="download-size">{output ? formatBytes(output.blob.size) : ''}</span>
      </button>
      <p>No sign-up. No limits on creativity.</p>
    </div>
  )
}
export function downloadEditor(editor: Editor) {
  if (!editor.output || !editor.settings || editor.processing || editor.loading) return false
  downloadBlob(editor.output.blob, outputName(editor.filename, editor.settings.format))
  return true
}
