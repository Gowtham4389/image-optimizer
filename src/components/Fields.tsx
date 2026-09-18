import { useEffect, useState } from 'react'

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <label className={`toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <span>
        <span className="toggle-label">{label}</span>
        {description && <span className="field-hint">{description}</span>}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <span />
      </span>
    </label>
  )
}
export function RangeControl({
  label,
  value,
  onChange,
  min = 1,
  max = 100,
  suffix = '%',
  disabled = false,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  suffix?: string
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <div className="range-control">
      <div className="field-heading">
        <span>{label}</span>
        <span className="value-badge">
          {draft}
          <span>{suffix}</span>
        </span>
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={draft}
        disabled={disabled}
        style={
          { '--range-progress': `${((draft - min) / (max - min)) * 100}%` } as React.CSSProperties
        }
        onChange={(e) => setDraft(+e.target.value)}
        onPointerUp={() => onChange(draft)}
        onKeyUp={() => onChange(draft)}
        onBlur={() => onChange(draft)}
      />
    </div>
  )
}
