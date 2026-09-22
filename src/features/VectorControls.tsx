import { useRef, useState } from 'react'
import { Crop, FileUp, ArrowRight } from 'lucide-react'
import type { Editor } from '../hooks/useEditor'
import { extension } from '../utils/files'

export default function VectorControls({ editor, onCrop }: { editor: Editor; onCrop: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [scale, setScale] = useState(2)
  const vector = editor.image?.vectorScale !== undefined
  return (
    <div className="vector-converter">
      <div className="vector-converter-heading">
        <span>SVG / EPS</span>
        <ArrowRight size={16} />
        <span>IMAGE</span>
      </div>
      <h4>Bring your vectors to life.</h4>
      <p>Convert artwork to PNG, JPG, WebP, or AVIF. Crop it to the perfect frame.</p>
      <label htmlFor="vector-resolution">Import resolution</label>
      <select
        id="vector-resolution"
        value={scale}
        onChange={(event) => setScale(Number(event.target.value))}
      >
        <option value={1}>Standard · 1× (EPS: 72 dpi)</option>
        <option value={2}>High · 2× (EPS: 144 dpi)</option>
        <option value={4}>Extra high · 4× (EPS: 288 dpi)</option>
      </select>
      <button
        className="button primary full-width"
        disabled={editor.loading}
        onClick={() => input.current?.click()}
      >
        <FileUp size={17} />
        Choose SVG or EPS
      </button>
      <input
        ref={input}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept=".svg,.eps,image/svg+xml,application/postscript"
        aria-label="Choose vector file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void editor.openFile(file, false, scale)
          event.target.value = ''
        }}
      />
      {vector && (
        <div className="vector-import-details">
          <span>
            {extension(editor.image!.type).toUpperCase()} imported · {editor.image!.width} ×{' '}
            {editor.image!.height} px
          </span>
          <button
            className="button secondary full-width"
            onClick={onCrop}
            disabled={editor.loading}
          >
            <Crop size={16} />
            Crop before converting
          </button>
        </div>
      )}
      <p className="field-hint">
        Resolution applies to your next import. Large artwork is fitted within 8,192 px and 24 MP.
        Files stay on your device.
      </p>
    </div>
  )
}
