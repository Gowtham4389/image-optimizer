import {
  Check,
  ChevronDown,
  Link2,
  Unlink2,
  Sparkles,
  Info,
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react'
import { FORMATS, MAX_DIMENSION, type Format, type Settings, type Tab } from '../types'
import type { Editor } from '../hooks/useEditor'
import { validateDimensions } from '../utils/render'
import { useEffect, useState } from 'react'
import { RangeControl, Toggle } from './Fields'
import WatermarkControls from '../features/WatermarkControls'
import VectorControls from '../features/VectorControls'
export { RangeControl, Toggle } from './Fields'

export function FormatPicker({
  value,
  onChange,
  formats,
}: {
  value: Format
  onChange: (v: Format) => void
  formats: Format[]
}) {
  return (
    <div className="format-picker" role="group" aria-label="Output format">
      {FORMATS.map((f) => (
        <button
          key={f.value}
          className={value === f.value ? 'selected' : ''}
          disabled={!formats.includes(f.value)}
          title={
            !formats.includes(f.value)
              ? `${f.label} encoding is unavailable in this browser`
              : f.description
          }
          onClick={() => onChange(f.value)}
        >
          {f.label}
          {value === f.value && <Check size={13} />}
        </button>
      ))}
    </div>
  )
}
export function QualityControls({
  settings,
  update,
}: {
  settings: Settings
  update: (patch: Partial<Settings>) => void
}) {
  const lossless = settings.format === 'image/png'
  return (
    <>
      <RangeControl
        label="Image quality"
        value={settings.quality}
        onChange={(quality) => update({ quality })}
        disabled={lossless}
      />
      <div className="range-labels">
        <span>Smaller file</span>
        <span>Better quality</span>
      </div>
      <div className="quality-presets">
        {[
          { name: 'Low', value: 60 },
          { name: 'Medium', value: 75 },
          { name: 'High', value: 90 },
          { name: 'Maximum', value: 100 },
        ].map((p) => (
          <button
            disabled={lossless}
            className={settings.quality === p.value ? 'selected' : ''}
            key={p.name}
            onClick={() => update({ quality: p.value })}
          >
            {p.name}
          </button>
        ))}
      </div>
      <p className="field-hint quality-hint">
        {lossless
          ? 'PNG always uses lossless encoding. Quality does not apply.'
          : [60, 75, 90, 100].includes(settings.quality)
            ? 'A little smaller. Every detail still counts.'
            : `Custom quality · ${settings.quality}%`}
      </p>
    </>
  )
}

function DimensionField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return (
    <label className="dimension-field">
      {label}
      <span>
        <input
          type="number"
          aria-label={label}
          min="1"
          max={MAX_DIMENSION}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = Math.round(Number(draft))
            if (n > 0 && n !== value) onCommit(n)
            else if (n <= 0) setDraft(String(value))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <span>px</span>
      </span>
    </label>
  )
}
function ResizeControls({ editor }: { editor: Editor }) {
  const s = editor.settings!
  const [percent, setPercent] = useState('100')
  const naturalWidth = s.rotation % 180 ? s.source.height : s.source.width
  const naturalHeight = s.rotation % 180 ? s.source.width : s.source.height
  function dimensions(width: number, height: number) {
    try {
      validateDimensions(width, height)
      editor.update({ width, height })
      editor.setError('')
    } catch {
      editor.setError('Please keep each side below 8,193 pixels and the total under 24 megapixels.')
    }
  }
  const changeWidth = (width: number) =>
    dimensions(width, s.locked ? Math.max(1, Math.round((width * s.height) / s.width)) : s.height)
  const changeHeight = (height: number) =>
    dimensions(s.locked ? Math.max(1, Math.round((height * s.width) / s.height)) : s.width, height)
  const scaleTo = (percentage: number) => {
    if (percentage > 0) {
      setPercent(String(percentage))
      dimensions(
        Math.max(1, Math.round((naturalWidth * percentage) / 100)),
        Math.max(1, Math.round((naturalHeight * percentage) / 100)),
      )
    }
  }
  return (
    <>
      <div className="section-heading">
        <h3>The perfect fit.</h3>
        <p>Make your image work anywhere.</p>
      </div>
      <div className="dimension-row">
        <DimensionField label="Width" value={s.width} onCommit={changeWidth} />
        <button
          className={`icon-button lock-button ${s.locked ? 'active' : ''}`}
          aria-label={s.locked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
          aria-pressed={s.locked}
          onClick={() => editor.update({ locked: !s.locked })}
        >
          {s.locked ? <Link2 size={17} /> : <Unlink2 size={17} />}
        </button>
        <DimensionField label="Height" value={s.height} onCommit={changeHeight} />
      </div>
      <p className="field-hint">
        {s.locked
          ? 'Aspect ratio locked. Your image stays in proportion.'
          : 'Aspect ratio unlocked. Changing dimensions can stretch the image.'}
      </p>
      <label className="field-label" htmlFor="resize-preset">
        Quick resize
      </label>
      <div className="select-wrap">
        <select
          id="resize-preset"
          value="custom"
          onChange={(e) => {
            if (e.target.value === 'original') dimensions(naturalWidth, naturalHeight)
            else if (e.target.value !== 'custom') {
              const [w, h] = e.target.value.split('x').map(Number)
              if (s.locked) {
                const scale = Math.min(w / naturalWidth, h / naturalHeight)
                dimensions(
                  Math.max(1, Math.round(naturalWidth * scale)),
                  Math.max(1, Math.round(naturalHeight * scale)),
                )
              } else dimensions(w, h)
            }
          }}
        >
          <option value="custom">Custom dimensions</option>
          <option value="original">Original size</option>
          {['1920x1080', '1280x720', '1080x1080', '1080x1350', '1080x1920', '1200x630'].map((p) => (
            <option key={p} value={p}>
              {p.replace('x', ' × ')}
            </option>
          ))}
        </select>
        <ChevronDown size={15} />
      </div>
      <p className="field-hint">Presets fit inside the selected size when the ratio is locked.</p>
      <label className="field-label" htmlFor="percentage">
        Resize by percentage
      </label>
      <div className="percent-row">
        {[25, 50, 75].map((n) => (
          <button key={n} onClick={() => scaleTo(n)}>
            {n}%
          </button>
        ))}
        <div className="percent-input">
          <input
            id="percentage"
            type="number"
            min="1"
            max="1000"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            onBlur={() => scaleTo(Number(percent))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
          <span>%</span>
        </div>
      </div>
      {s.width > naturalWidth || s.height > naturalHeight ? (
        <div className="info-note">
          <Info size={15} />
          Upscaling adds pixels but cannot recover missing detail.
        </div>
      ) : (
        <div className="info-note">
          <Info size={15} />
          Start with the size you need. Smaller dimensions usually make the biggest difference.
        </div>
      )}
    </>
  )
}
export function Controls({
  editor,
  tab,
  onCrop,
}: {
  editor: Editor
  tab: Tab
  onCrop: () => void
}) {
  const s = editor.settings!
  const formatDescription = FORMATS.find((f) => f.value === s.format)!.description
  const canKeepExif = editor.image?.type === 'image/jpeg' && s.format === 'image/jpeg'
  if (tab === 'watermark') return <WatermarkControls editor={editor} />
  if (tab === 'resize') return <ResizeControls editor={editor} />
  if (tab === 'crop')
    return (
      <>
        <div className="section-heading">
          <h3>A fresh perspective.</h3>
          <p>Keep the part that tells your story.</p>
        </div>
        <div className="crop-illustration" aria-hidden="true">
          <div>
            <i />
            <i />
          </div>
        </div>
        <p className="control-description">
          Drag the crop handles, choose an aspect ratio, or move your image to find the perfect
          frame.
        </p>
        <button className="button primary full-width" onClick={onCrop}>
          Open crop editor
          <ArrowUpRight size={16} />
        </button>
        <div className="info-note">
          <Info size={16} />
          Your original is always safe. Undo a crop at any time.
        </div>
      </>
    )
  if (tab === 'adjust')
    return (
      <>
        <div className="section-heading">
          <h3>A finishing touch.</h3>
          <p>Small adjustments. A big difference.</p>
        </div>
        <div className="transform-buttons">
          {[
            {
              label: 'Rotate left',
              icon: RotateCcw,
              patch: { rotation: (s.rotation + 270) % 360, width: s.height, height: s.width },
            },
            {
              label: 'Rotate right',
              icon: RotateCw,
              patch: { rotation: (s.rotation + 90) % 360, width: s.height, height: s.width },
            },
            { label: 'Flip horizontal', icon: FlipHorizontal2, patch: { flipX: !s.flipX } },
            { label: 'Flip vertical', icon: FlipVertical2, patch: { flipY: !s.flipY } },
          ].map((t) => (
            <button
              key={t.label}
              className="icon-button"
              aria-label={t.label}
              title={t.label}
              onClick={() => editor.update(t.patch)}
            >
              <t.icon size={19} />
            </button>
          ))}
        </div>
        {(['brightness', 'contrast', 'saturation'] as const).map((k) => (
          <RangeControl
            key={k}
            label={k[0].toUpperCase() + k.slice(1)}
            min={0}
            max={200}
            value={s[k]}
            onChange={(v) => editor.update({ [k]: v })}
          />
        ))}
        <Toggle
          label="Grayscale"
          description="A timeless black-and-white look."
          checked={s.grayscale}
          onChange={(grayscale) => editor.update({ grayscale })}
        />
        <button
          className="text-button"
          onClick={() =>
            editor.update({ brightness: 100, contrast: 100, saturation: 100, grayscale: false })
          }
        >
          Reset adjustments
        </button>
      </>
    )
  return (
    <>
      <div className="section-heading">
        <h3>{tab === 'convert' ? 'The right format.' : 'Less weight. Same wow.'}</h3>
        <p>
          {tab === 'convert'
            ? 'One image. More possibilities.'
            : 'Find the sweet spot for your image.'}
        </p>
      </div>
      {tab === 'convert' && <VectorControls editor={editor} onCrop={onCrop} />}
      <div className="field-heading">
        <label>Output format</label>
        {s.format === 'image/webp' && <span className="tiny-badge">RECOMMENDED</span>}
      </div>
      <FormatPicker
        value={s.format}
        onChange={(format) => editor.update({ format })}
        formats={editor.formats}
      />
      <p className="field-hint format-hint">{formatDescription}</p>
      {s.format === 'image/jpeg' && (
        <label className="color-field">
          Background color
          <span>
            <input
              type="color"
              aria-label="JPEG background color"
              value={s.background}
              onChange={(e) => editor.update({ background: e.target.value })}
            />
            {s.background.toUpperCase()}
          </span>
        </label>
      )}
      <div className="control-divider" />
      <QualityControls settings={s} update={editor.update} />
      <div className="control-divider" />
      <button
        className="smart-card"
        onClick={() =>
          editor.update({
            quality: 90,
            format: editor.formats.includes('image/webp')
              ? 'image/webp'
              : editor.image?.type === 'image/jpeg'
                ? 'image/jpeg'
                : 'image/png',
            removeMetadata: true,
          })
        }
      >
        <span className="smart-icon">
          <Sparkles size={19} />
        </span>
        <span>
          <strong>Smart optimization</strong>
          <span>Our balanced settings, in one click.</span>
        </span>
        <ArrowUpRight size={16} />
      </button>
      <Toggle
        label="Remove image metadata"
        description="Leave out EXIF, GPS, and camera details."
        checked={canKeepExif ? s.removeMetadata : true}
        onChange={(removeMetadata) => editor.update({ removeMetadata })}
        disabled={!canKeepExif}
      />
      <p className="metadata-hint">
        {canKeepExif
          ? !s.removeMetadata
            ? 'EXIF will be preserved, including any location data. XMP and other metadata are not copied.'
            : 'A little more privacy. A little less file size.'
          : 'Always removed for this format. Optional EXIF preservation is available for JPG → JPG.'}
      </p>
      <div className="info-note">
        <ShieldCheck size={16} />
        <span>All processing happens right here, in your browser.</span>
      </div>
    </>
  )
}
